/**
 * app/api/bot/reset-stale/route.ts — Rescata DNIs atascados
 * Protegido con API key interna del bot.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const BOT_API_KEY = process.env.BOT_API_KEY;
if (!BOT_API_KEY) {
  throw new Error('Falta BOT_API_KEY en variables de entorno');
}

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-bot-api-key');
  if (apiKey !== BOT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { minutos = 5 } = await req.json().catch(() => ({}));

    const { rowCount } = await pool.query(
      `UPDATE clientes_proyectos cp
       SET datos = jsonb_set(datos, '{estado}', '"pendiente"'),
           updated_at = now()
       WHERE cp.proyecto_id = (SELECT id FROM proyectos WHERE nombre = 'orange')
         AND cp.datos->>'estado' = 'en_progreso'
         AND cp.updated_at < now() - ($1 || ' minutes')::interval`,
      [String(minutos)]
    );

    return NextResponse.json({ rescatados: rowCount ?? 0 });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
