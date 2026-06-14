/**
 * app/api/pipeline/backoffice-stats/route.ts — Stats para dashboard backoffice
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [r1, r2, r3, r4, r5, r6] = await Promise.all([
      pool.query(`SELECT COUNT(*) as total FROM pipeline WHERE estado = 'venta' AND deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*) as total FROM pipeline WHERE estado = 'tramitado' AND ultimo_cambio::date = current_date AND deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*) as total FROM pipeline WHERE estado = 'activado' AND ultimo_cambio::date = current_date AND deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*) as total FROM pipeline WHERE estado = 'tramitado' AND deleted_at IS NULL`),
      pool.query(`SELECT COUNT(DISTINCT asesor_id) as total FROM pipeline WHERE estado = 'venta' AND deleted_at IS NULL`),
      pool.query(`
        SELECT COALESCE(
          AVG(EXTRACT(EPOCH FROM (ultimo_cambio - created_at)) / 3600)::int,
          0
        ) as horas
        FROM pipeline
        WHERE estado = 'tramitado' AND deleted_at IS NULL
          AND ultimo_cambio::date = current_date
      `),
    ]);

    const horas = parseInt(r6.rows[0].horas);
    const tiempoPromedio = horas > 0
      ? horas < 24 ? `${horas}h` : `${Math.round(horas / 24)}d`
      : '—';

    return NextResponse.json({
      pendientes: parseInt(r1.rows[0].total),
      tramitadasHoy: parseInt(r2.rows[0].total),
      activadasHoy: parseInt(r3.rows[0].total),
      totalTramitadas: parseInt(r4.rows[0].total),
      asesoresActivos: parseInt(r5.rows[0].total),
      tiempoPromedio,
    });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
