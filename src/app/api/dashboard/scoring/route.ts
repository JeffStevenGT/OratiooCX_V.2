/**
 * GET /api/dashboard/scoring — Scoring de leads (distribución + detalle)
 * POST /api/dashboard/scoring — Recalcular scoring masivo
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const proyectoId = searchParams.get('proyecto_id') || '1';
  const nivel = searchParams.get('nivel') || '';

  try {
    // Distribución
    const { rows: distribucion } = await pool.query(
      'SELECT * FROM v_scoring_resumen WHERE proyecto_id = $1',
      [proyectoId]
    );

    // Lista detallada
    let query = `
      SELECT sl.*, c.nombre_razon_social, c.telefonos
      FROM scoring_leads sl
      JOIN clientes c ON sl.id_cliente = c.id_cliente
      WHERE sl.proyecto_id = $1
    `;
    const params: any[] = [proyectoId];

    if (nivel) {
      params.push(nivel);
      query += ` AND sl.nivel = $${params.length}`;
    }
    query += ` ORDER BY sl.puntuacion DESC LIMIT 200`;

    const { rows: leads } = await pool.query(query, params);

    // KPIs
    const { rows: [kpis] } = await pool.query(`
      SELECT
        COUNT(*)::int as total_evaluados,
        COUNT(*) FILTER (WHERE nivel IN ('A+','A'))::int as top_leads,
        COUNT(*) FILTER (WHERE nivel IN ('A+','A','B'))::int as calientes,
        COUNT(*) FILTER (WHERE nivel IN ('D','E'))::int as frios,
        ROUND(AVG(puntuacion)::numeric, 1) as puntuacion_media
      FROM scoring_leads
      WHERE proyecto_id = $1
    `, [proyectoId]);

    return NextResponse.json({
      kpis: kpis || { total_evaluados: 0, top_leads: 0, calientes: 0, frios: 0, puntuacion_media: 0 },
      distribucion,
      leads,
    });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const proyectoId = body.proyecto_id || 1;

  try {
    const { rows } = await pool.query(
      'SELECT * FROM calcular_scoring_masivo($1)',
      [proyectoId]
    );

    return NextResponse.json({ ok: true, distribucion: rows });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
