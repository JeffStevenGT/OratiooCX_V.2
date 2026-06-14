/**
 * app/api/bot/next-dni/route.ts — Siguiente DNI Pendiente
 * Protegido con API key interna del bot.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const BOT_API_KEY = process.env.BOT_API_KEY;
if (!BOT_API_KEY) {
  throw new Error('Falta BOT_API_KEY en variables de entorno');
}

export async function GET(req: Request) {
  const apiKey = req.headers.get('x-bot-api-key');
  if (apiKey !== BOT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { rows } = await pool.query(`
      WITH tomado AS (
        SELECT cp.id, cp.id_cliente
        FROM clientes_proyectos cp
        WHERE cp.proyecto_id = (SELECT id FROM proyectos WHERE nombre = 'orange')
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
