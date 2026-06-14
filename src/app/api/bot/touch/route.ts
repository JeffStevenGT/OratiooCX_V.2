/**
 * app/api/bot/touch/route.ts — Touch DNI (mantiene vivo el updated_at)
 * Protegido con API key interna del bot.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const BOT_API_KEY = process.env.BOT_API_KEY;
if (!BOT_API_KEY) {
  throw new Error('Falta BOT_API_KEY en variables de entorno');
}

export async function PATCH(req: Request) {
  const apiKey = req.headers.get('x-bot-api-key');
  if (apiKey !== BOT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id_cliente } = await req.json();
    if (!id_cliente) return NextResponse.json({ error: 'Falta id_cliente' }, { status: 400 });

    await pool.query(
      `UPDATE clientes_proyectos
       SET updated_at = now()
       WHERE id_cliente = $1
         AND proyecto_id = (SELECT id FROM proyectos WHERE nombre = 'orange')
         AND datos->>'estado' = 'en_progreso'`,
      [id_cliente]
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
