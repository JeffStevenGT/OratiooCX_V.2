/**
 * app/api/clientes/[id]/route.ts — Ficha individual y actualización
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

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

    return NextResponse.json({ ...cliente, detecciones });
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
