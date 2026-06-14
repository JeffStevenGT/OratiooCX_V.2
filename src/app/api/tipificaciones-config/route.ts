/**
 * GET /api/tipificaciones-config — Listar codificaciones (filtrar por tipo, proyecto)
 * POST /api/tipificaciones-config — Crear nueva codificación (supervisor/jefe)
 * PATCH /api/tipificaciones-config — Activar/desactivar o editar
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole } from '@/lib/auth-roles';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const proyecto = searchParams.get('proyecto_id') || '1';
  const tipo = searchParams.get('tipo'); // 'estado' | 'sub_estado'

  let query = 'SELECT * FROM tipificaciones_config WHERE proyecto_id = $1';
  const params: any[] = [proyecto];
  let pi = 2;

  if (tipo) { query += ` AND tipo = $${pi++}`; params.push(tipo); }
  query += ' ORDER BY tipo, orden, id';

  try {
    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireRole('supervisor', 'jefe_area', 'desarrollador');
    const { proyecto_id, tipo, codigo, etiqueta, color, afecta_calidad, orden } = await req.json();
    if (!tipo || !codigo || !etiqueta) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
    }
    const { rows: [tc] } = await pool.query(
      `INSERT INTO tipificaciones_config (proyecto_id, tipo, codigo, etiqueta, color, afecta_calidad, orden)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [proyecto_id || 1, tipo, codigo.toLowerCase().replace(/\s+/g, '_'), etiqueta, color || '#6b7280', afecta_calidad || false, orden || 0]
    );
    return NextResponse.json(tc, { status: 201 });
  } catch (e: any) {
    if (e.code === '23505') return NextResponse.json({ error: 'Ya existe' }, { status: 409 });
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireRole('supervisor', 'jefe_area', 'desarrollador');
    const { id, activo, etiqueta, color, afecta_calidad, orden } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

    const updates: string[] = [];
    const params: any[] = [];
    let pi = 1;

    if (activo !== undefined) { updates.push(`activo = $${pi++}`); params.push(activo); }
    if (etiqueta) { updates.push(`etiqueta = $${pi++}`); params.push(etiqueta); }
    if (color) { updates.push(`color = $${pi++}`); params.push(color); }
    if (afecta_calidad !== undefined) { updates.push(`afecta_calidad = $${pi++}`); params.push(afecta_calidad); }
    if (orden !== undefined) { updates.push(`orden = $${pi++}`); params.push(orden); }

    if (!updates.length) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });

    updates.push('updated_at = now()');
    params.push(id);

    await pool.query(`UPDATE tipificaciones_config SET ${updates.join(', ')} WHERE id = $${pi}`, params);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
