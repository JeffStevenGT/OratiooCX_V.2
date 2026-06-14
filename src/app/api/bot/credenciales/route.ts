/**
 * app/api/bot/credenciales/route.ts — Pool de credenciales para workers
 * Solo accesible desde localhost o con token interno.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  try {
    // Protección: solo localhost o token interno del bot
    const auth = req.headers.get('authorization') || '';
    const expectedToken = process.env.BOT_API_KEY;
    if (!expectedToken) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 });
    }
    
    if (auth !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { rows } = await pool.query(
      `SELECT id, usuario, password FROM credenciales_bot WHERE activo = true ORDER BY id`
    );

    return NextResponse.json(rows);
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
