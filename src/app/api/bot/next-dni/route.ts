/**
 * app/api/bot/next-dni/route.ts — Siguiente DNI Pendiente
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await pool.query(`
      WITH tomado AS (
        SELECT cp.id, cp.id_cliente
        FROM clientes_proyectos cp
        WHERE cp.proyecto_id = 1
          AND cp.datos->>'estado' = 'pendiente'
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE clientes_proyectos cp
      SET datos = jsonb_set(datos, '{estado}', '"en_progreso"'),
          updated_at = now()
      FROM tomado
      WHERE cp.id = tomado.id
      RETURNING cp.id_cliente
    `);
    if (rows.length === 0) return NextResponse.json({ dni: null });
    return NextResponse.json({ dni: rows[0].id_cliente });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
