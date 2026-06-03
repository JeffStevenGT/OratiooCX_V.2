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

// PATCH — actualizar tipo_persona
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tipo_persona } = await req.json();

  if (!['natural', 'autonomo', 'empresa'].includes(tipo_persona)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  }

  try {
    await pool.query(
      `UPDATE clientes SET tipo_persona = $1, updated_at = now() WHERE id_cliente = $2`,
      [tipo_persona, id]
    );
    return NextResponse.json({ success: true, tipo_persona });
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
