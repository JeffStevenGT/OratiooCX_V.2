/**
 * GET /api/dashboard/forecast — Forecast de ventas
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const proyectoId = parseInt(searchParams.get('proyecto_id') || '1');
  const dias = parseInt(searchParams.get('dias') || '30');
  const forecast = parseInt(searchParams.get('forecast') || '7');

  try {
    const { rows } = await pool.query(
      'SELECT * FROM forecast_ventas($1, $2, $3)',
      [proyectoId, dias, forecast]
    );

    // Separar histórico y forecast
    const historico = rows.filter(r => r.tipo === 'historico');
    const prediccion = rows.filter(r => r.tipo === 'forecast');

    // Total forecast
    const totalForecast = prediccion.reduce((s, r) => s + (r.ventas || 0), 0);
    const media = historico.length > 0
      ? Math.round(historico.reduce((s, r) => s + (r.ventas || 0), 0) / historico.length)
      : 0;

    return NextResponse.json({
      historico,
      prediccion,
      resumen: {
        media_diaria: media,
        total_forecast: totalForecast,
        dias_forecast: prediccion.length,
      },
    });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
