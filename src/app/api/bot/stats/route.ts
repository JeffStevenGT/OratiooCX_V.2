/**
 * app/api/bot/stats/route.ts — Estadísticas del bot (hora del servidor)
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { rows: maquinas } = await pool.query(
      `SELECT COUNT(*)::int as total, 
              COALESCE(SUM(workers_activos), 0)::int as workers
       FROM maquinas WHERE estado = 'online'`
    );
    const { total: maquinasOnline, workers: totalWorkers } = maquinas[0];

    const { rows: [hoy] } = await pool.query(`
      SELECT COUNT(*)::int as total
      FROM clientes_proyectos
      WHERE proyecto_id = (SELECT id FROM proyectos WHERE nombre = 'orange')
      AND ultima_extraccion >= CURRENT_DATE
    `);

    const { rows: [pend] } = await pool.query(`
      SELECT COUNT(*)::int as total
      FROM clientes_proyectos
      WHERE proyecto_id = (SELECT id FROM proyectos WHERE nombre = 'orange')
      AND (datos->>'estado' = 'pendiente' OR datos->>'estado' IS NULL)
    `);

    const { rows: [horaRow] } = await pool.query(
      `SELECT EXTRACT(HOUR FROM NOW())::int as h, EXTRACT(MINUTE FROM NOW())::int as m`
    );
    const horasTranscurridas = Math.max(1, horaRow.h + (horaRow.m / 60));
    const velocidad = hoy.total > 0 ? Math.round(hoy.total / horasTranscurridas) : 0;
    const etaHoras = velocidad > 0 ? Math.round(pend.total / velocidad) : 0;

    return NextResponse.json({
      online: maquinasOnline > 0,
      maquinasOnline,
      totalWorkers,
      procesadosHoy: hoy.total,
      pendientes: pend.total,
      velocidad,
      etaHoras,
    });
  } catch {
    return NextResponse.json({
      online: false, maquinasOnline: 0, totalWorkers: 0,
      procesadosHoy: 0, pendientes: 0, velocidad: 0, etaHoras: 0,
    });
  }
}
