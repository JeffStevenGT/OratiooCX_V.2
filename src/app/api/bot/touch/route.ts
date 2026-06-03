/**
 * app/api/bot/touch/route.ts — Touch DNI (mantiene vivo el updated_at)
 * =====================================================================
 * El worker llama a este endpoint mientras procesa un DNI.
 * Así el rescate de DNIs atascados sabe que este DNI sigue vivo.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PATCH(req: Request) {
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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
