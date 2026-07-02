/**
 * app/api/bot/command/route.ts — Comandos al Bot (Multi-Máquina)
 * ================================================================
 * POST: Frontend (autenticado) envía comando
 * GET:  Coordinator consulta comandos para su máquina
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import pool from '@/lib/db';

// ── POST: Frontend envía comando ──
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const role = (session.user as any).role;
  if (!['jefe_area', 'it', 'desarrollador', 'supervisor'].includes(role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { comando, workers, maquina, proxy } = await req.json();
  if (!comando) return NextResponse.json({ error: 'Falta comando' }, { status: 400 });

  const params: Record<string, any> = {};
  if (workers && comando === 'iniciar') {
    params.workers = Math.max(1, Math.min(20, workers));
  }
  if (proxy !== undefined) {
    params.proxy = !!proxy;
  }

  const destino = maquina || '*';

  // Limpiar comandos viejos (en_curso > 1 hora)
  await pool.query(
    `DELETE FROM comandos_bot WHERE estado = 'en_curso' AND ejecutado_at < now() - interval '1 hour'`
  );

  await pool.query(
    `INSERT INTO comandos_bot (maquina_destino, comando, parametros, estado)
     VALUES ($1, $2, $3, 'pendiente')`,
    [destino, comando, JSON.stringify(params)]
  );

  return NextResponse.json({ success: true, comando, maquina: destino, workers: params.workers });
}

// ── GET: Coordinator consulta comandos para su máquina ──
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const maquina = searchParams.get('maquina');

  if (!maquina) {
    return NextResponse.json({ error: 'Falta parámetro maquina' }, { status: 400 });
  }

  const { rows } = await pool.query(
    `UPDATE comandos_bot SET estado = 'en_curso', ejecutado_at = now()
     WHERE estado = 'pendiente'
       AND (maquina_destino = $1 OR maquina_destino = '*')
     RETURNING comando, parametros`,
    [maquina]
  );

  return NextResponse.json({
    comandos: rows.map(r => ({ comando: r.comando, parametros: r.parametros || {} }))
  });
}
