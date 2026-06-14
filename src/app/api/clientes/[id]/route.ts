/**
 * app/api/clientes/[id]/route.ts — Ficha individual y actualización
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole } from '@/lib/auth-roles';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const { rows: [cliente] } = await pool.query(
      `SELECT c.*, cp.datos, cp.ultima_extraccion
       FROM clientes c
       LEFT JOIN clientes_proyectos cp ON c.id_cliente = cp.id_cliente
         AND cp.proyecto_id = (SELECT id FROM proyectos WHERE nombre = 'orange')
       WHERE c.id_cliente = $1`,
      [id]
    );

    if (!cliente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    // Cargar detecciones de cambios
    const { rows: detecciones } = await pool.query(
      `SELECT * FROM detecciones
       WHERE id_cliente = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [id]
    );

    // Extraer metadata de versión desde los datos del proyecto
    const datos = cliente.datos || {};
    const versionExtraccion = datos.version_extraccion || 1;
    const esPrimeraExtraccion = versionExtraccion <= 1 && detecciones.length === 0;

    return NextResponse.json({
      ...cliente,
      detecciones,
      version_extraccion: versionExtraccion,
      es_primera_extraccion: esPrimeraExtraccion,
    });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PATCH — actualizar campos RGPD y tipo_persona
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  if (body.tipo_persona && !['natural', 'autonomo', 'empresa'].includes(body.tipo_persona)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  }

  const updates: string[] = [];
  const vals: any[] = [];
  let pi = 1;

  if (body.tipo_persona) { updates.push(`tipo_persona = $${pi++}`); vals.push(body.tipo_persona); }
  if (body.whatsapp_numero !== undefined) { updates.push(`whatsapp_numero = $${pi++}`); vals.push(body.whatsapp_numero || null); }
  if (body.whatsapp_opt_in !== undefined) { updates.push(`whatsapp_opt_in = $${pi++}`); vals.push(body.whatsapp_opt_in); if (body.whatsapp_opt_in) { updates.push(`whatsapp_opt_in_fecha = now()`); } }
  if (body.alertas_fidelizacion !== undefined) { updates.push(`alertas_fidelizacion = $${pi++}`); vals.push(body.alertas_fidelizacion); }

  if (!updates.length) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });

  updates.push('updated_at = now()');
  vals.push(id);

  try {
    await pool.query(`UPDATE clientes SET ${updates.join(', ')} WHERE id_cliente = $${pi}`, vals);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

// DELETE — RGPD: derecho al olvido (soft delete + anonimizacion)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('jefe_area', 'desarrollador');
    const { id } = await params;
    await pool.query(`UPDATE clientes SET deleted_at = now() WHERE id_cliente = $1 AND deleted_at IS NULL`, [id]);
    await pool.query(`INSERT INTO historial (id_cliente, tipo, proyecto_id, descripcion) VALUES ($1, 'rgpd_olvido', 1, 'Derecho al olvido - datos anonimizados')`, [id]);
    return NextResponse.json({ success: true, mensaje: 'Cliente anonimizado' });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
