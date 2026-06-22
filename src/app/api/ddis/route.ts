/**
 * app/api/ddis/route.ts — CRUD del catálogo de DDIs (números de salida por provincia)
 * Acceso: solo rol it y desarrollador.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole } from '@/lib/auth-roles';

const ESTADOS = ['activo', 'spam', 'no_alta', 'pausado'];

function noAuth(e: any) {
  if (e.message === 'No autenticado') return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (e.message === 'No autorizado') return NextResponse.json({ error: 'Solo it o desarrollador' }, { status: 403 });
  return null;
}

/** Normaliza prefijos: acepta array o string "91,81" → text[] */
function normPrefijos(p: any): string[] {
  if (Array.isArray(p)) return p.map((x) => String(x).trim()).filter(Boolean);
  if (typeof p === 'string') return p.split(',').map((x) => x.trim()).filter(Boolean);
  return [];
}

// GET — listar (filtros: estado, codigo_prov, q) + resumen
export async function GET(req: Request) {
  try {
    await requireRole('it', 'desarrollador');
    const { searchParams } = new URL(req.url);
    const estado = searchParams.get('estado') || '';
    const codigoProv = searchParams.get('codigo_prov') || '';
    const q = searchParams.get('q') || '';

    let query = 'SELECT * FROM ddis WHERE 1=1';
    const params: any[] = [];
    let pi = 1;

    if (estado) { params.push(estado); query += ` AND estado = $${pi++}`; }
    if (codigoProv) { params.push(codigoProv); query += ` AND codigo_prov = $${pi++}`; }
    if (q) { params.push(`%${q}%`); query += ` AND (ddi ILIKE $${pi} OR provincia ILIKE $${pi})`; pi++; }

    query += ' ORDER BY codigo_prov, ddi LIMIT 1000';
    const { rows } = await pool.query(query, params);

    const { rows: resumen } = await pool.query(
      `SELECT estado, count(*)::int AS n, count(outbound_id)::int AS con_uuid
         FROM ddis GROUP BY estado ORDER BY estado`,
    );
    const { rows: [tot] } = await pool.query(
      `SELECT count(*)::int AS total, count(DISTINCT codigo_prov)::int AS provincias,
              count(outbound_id)::int AS con_uuid
         FROM ddis`,
    );

    return NextResponse.json({ ddis: rows, resumen, total: tot });
  } catch (e: any) {
    const na = noAuth(e); if (na) return na;
    console.error('[api/ddis]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST — crear DDI
export async function POST(req: Request) {
  try {
    await requireRole('it', 'desarrollador');
    const b = await req.json();
    const ddi = (b.ddi || '').trim();
    if (!b.provincia || !ddi) {
      return NextResponse.json({ error: 'provincia y ddi son obligatorios' }, { status: 400 });
    }
    const estado = ESTADOS.includes(b.estado) ? b.estado : 'activo';

    const { rows: [row] } = await pool.query(
      `INSERT INTO ddis (provincia, codigo_prov, prefijos, ddi, outbound_id, campana, tipo_llamada, estado, comentarios, fecha_alta, fecha_estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CURRENT_DATE, CURRENT_DATE) RETURNING *`,
      [b.provincia, b.codigo_prov || null, normPrefijos(b.prefijos), ddi,
       b.outbound_id || null, b.campana || null, b.tipo_llamada || null, estado, b.comentarios || null],
    );
    return NextResponse.json(row, { status: 201 });
  } catch (e: any) {
    const na = noAuth(e); if (na) return na;
    if (e.code === '23505') return NextResponse.json({ error: 'Ese DDI ya existe' }, { status: 409 });
    console.error('[api/ddis]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PATCH — actualizar DDI por id
export async function PATCH(req: Request) {
  try {
    await requireRole('it', 'desarrollador');
    const b = await req.json();
    if (!b.id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

    const updates: string[] = [];
    const params: any[] = [];
    let pi = 1;

    if (b.provincia !== undefined) { updates.push(`provincia = $${pi++}`); params.push(b.provincia); }
    if (b.codigo_prov !== undefined) { updates.push(`codigo_prov = $${pi++}`); params.push(b.codigo_prov || null); }
    if (b.prefijos !== undefined) { updates.push(`prefijos = $${pi++}`); params.push(normPrefijos(b.prefijos)); }
    if (b.ddi !== undefined) { updates.push(`ddi = $${pi++}`); params.push(String(b.ddi).trim()); }
    if (b.outbound_id !== undefined) { updates.push(`outbound_id = $${pi++}`); params.push(b.outbound_id || null); }
    if (b.campana !== undefined) { updates.push(`campana = $${pi++}`); params.push(b.campana || null); }
    if (b.tipo_llamada !== undefined) { updates.push(`tipo_llamada = $${pi++}`); params.push(b.tipo_llamada || null); }
    if (b.comentarios !== undefined) { updates.push(`comentarios = $${pi++}`); params.push(b.comentarios || null); }
    if (b.estado !== undefined) {
      if (!ESTADOS.includes(b.estado)) return NextResponse.json({ error: 'estado inválido' }, { status: 400 });
      updates.push(`estado = $${pi++}`); params.push(b.estado);
      updates.push(`fecha_estado = CURRENT_DATE`);
    }

    if (updates.length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    updates.push(`updated_at = now()`);
    params.push(b.id);

    const { rows: [row] } = await pool.query(
      `UPDATE ddis SET ${updates.join(', ')} WHERE id = $${pi} RETURNING *`, params,
    );
    if (!row) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json(row);
  } catch (e: any) {
    const na = noAuth(e); if (na) return na;
    if (e.code === '23505') return NextResponse.json({ error: 'Ese DDI ya existe' }, { status: 409 });
    console.error('[api/ddis]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE — eliminar DDI por id (?id=)
export async function DELETE(req: Request) {
  try {
    await requireRole('it', 'desarrollador');
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
    await pool.query('DELETE FROM ddis WHERE id = $1', [parseInt(id)]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    const na = noAuth(e); if (na) return na;
    console.error('[api/ddis]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
