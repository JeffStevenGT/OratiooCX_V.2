/**
 * app/api/bot/command/route.ts — Comandos al Bot
 * ================================================
 * Frontend → POST /api/bot/command { comando: "iniciar" | "detener" | "pausar" | "reanudar" | "reset_cola", workers: 5 }
 * El bot/coordinator consulta GET /api/bot/command para ver comandos nuevos.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ── POST: Frontend envía comando ──
export async function POST(req: Request) {
  const { comando, workers } = await req.json();
  if (!comando) return NextResponse.json({ error: 'Falta comando' }, { status: 400 });

  const params: Record<string, any> = {};
  if (workers && comando === 'iniciar') {
    params.workers = Math.max(1, Math.min(20, workers));
  }

  await pool.query(
    `INSERT INTO comandos_bot (maquina_destino, comando, parametros, estado)
     VALUES ('*', $1, $2, 'pendiente')`,
    [comando, JSON.stringify(params)]
  );

  return NextResponse.json({ success: true, comando, workers: params.workers });
}

// ── GET: Bot/coordinator consulta comandos pendientes ──
export async function GET() {
  const { rows } = await pool.query(
    `UPDATE comandos_bot SET estado = 'en_curso', ejecutado_at = now()
     WHERE estado = 'pendiente'
     RETURNING comando, parametros`
  );
  return NextResponse.json({
    comandos: rows.map(r => ({ comando: r.comando, parametros: r.parametros || {} }))
  });
}
