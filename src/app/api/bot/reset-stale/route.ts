/**
 * app/api/bot/reset-stale/route.ts — Rescata DNIs atascados
 * ==========================================================
 * Devuelve a 'pendiente' los DNIs que llevan más de N minutos en 'en_progreso'.
 * Los worker zombies no los van a terminar — mejor resetearlos.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
