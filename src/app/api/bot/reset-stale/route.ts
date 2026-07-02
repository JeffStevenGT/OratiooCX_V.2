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
    const { minutos = 5, estado = 'en_progreso' } = await req.json().catch(() => ({}));

    // Validar estado: solo 'en_progreso' o 'error'
    const estadoValido = estado === 'error' ? 'error' : 'en_progreso';

    const { rowCount } = await pool.query(
      `WITH proyecto AS (SELECT id AS pid FROM proyectos WHERE nombre = 'orange')
       UPDATE clientes_proyectos cp
       SET datos = jsonb_set(datos, '{estado}', '"pendiente"'),
           updated_at = now()
       FROM proyecto p
       WHERE cp.proyecto_id = p.pid
         AND cp.datos->>'estado' = $2
         AND cp.updated_at < now() - ($1 || ' minutes')::interval`,
      [String(minutos), estadoValido]
    );

    return NextResponse.json({ rescatados: rowCount ?? 0 });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
