/**
 * app/api/bot/command/route.ts — Comandos al Bot
 * ================================================
 * Frontend → POST /api/bot/command { comando: "iniciar" | "detener" | "pausar" | "reanudar" | "reset_cola" }
 * El bot consulta GET /api/bot/command?estado=pendiente para ver comandos nuevos.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ── POST: Frontend envía comando ──
export async function POST(req: Request) {
  const { comando } = await req.json();
  if (!comando) return NextResponse.json({ error: 'Falta comando' }, { status: 400 });

  await pool.query(
    `INSERT INTO comandos_bot (maquina_destino, comando, parametros, estado)
     VALUES ('*', $1, '{}', 'pendiente')`,
    [comando]
  );

  return NextResponse.json({ success: true, comando });
}

// ── GET: Bot consulta comandos pendientes ──
export async function GET() {
  const { rows } = await pool.query(
    `UPDATE comandos_bot SET estado = 'en_curso', ejecutado_at = now()
     WHERE estado = 'pendiente'
     RETURNING comando`
  );
  return NextResponse.json({ comandos: rows.map(r => r.comando) });
}
