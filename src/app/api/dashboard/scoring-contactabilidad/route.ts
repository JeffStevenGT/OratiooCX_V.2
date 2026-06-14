/**
 * GET /api/dashboard/scoring-contactabilidad — Scoring por historial de contacto (Yone)
 * POST /api/dashboard/scoring-contactabilidad — Recalcular masivo
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const proyectoId = searchParams.get('proyecto_id') || '1';
  const nivel = searchParams.get('nivel') || '';

  try {
    let query = `
      SELECT sc.*, c.nombre_razon_social
      FROM scoring_contactabilidad sc
      JOIN clientes c ON sc.id_cliente = c.id_cliente
      WHERE sc.proyecto_id = $1
    `;
    const params: any[] = [proyectoId];

    if (nivel) {
      params.push(nivel);
      query += ` AND sc.nivel = $${params.length}`;
    }
    query += ` ORDER BY sc.puntuacion DESC LIMIT 200`;

    const { rows: leads } = await pool.query(query, params);

    const { rows: [kpis] } = await pool.query(`
      SELECT
        COUNT(*)::int as total_evaluados,
        COUNT(*) FILTER (WHERE nivel IN ('A+','A'))::int as top_leads,
        COUNT(*) FILTER (WHERE nivel IN ('A+','A','B'))::int as calientes,
        ROUND(AVG(puntuacion)::numeric, 1) as puntuacion_media
      FROM scoring_contactabilidad
      WHERE proyecto_id = $1
    `, [proyectoId]);

    return NextResponse.json({
      kpis: kpis || { total_evaluados: 0, top_leads: 0, calientes: 0, puntuacion_media: 0 },
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
      'SELECT * FROM calcular_scoring_contacto_masivo($1)',
      [proyectoId]
    );

    return NextResponse.json({ ok: true, distribucion: rows });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
