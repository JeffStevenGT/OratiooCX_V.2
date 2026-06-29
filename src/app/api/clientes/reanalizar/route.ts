/**
 * app/api/clientes/reanalizar/route.ts
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  const { id_cliente } = await req.json();
  if (!id_cliente) return NextResponse.json({ error: 'Falta id_cliente' }, { status: 400 });

  await pool.query(
    `UPDATE clientes_proyectos
     SET datos = jsonb_set(
            jsonb_set(datos, '{estado}', '"pendiente"'),
            '{version_extraccion}', '0'
          ), updated_at = now()
     WHERE id_cliente = $1 AND proyecto_id = 1`,
    [id_cliente]
  );

  return NextResponse.json({ success: true });
}
