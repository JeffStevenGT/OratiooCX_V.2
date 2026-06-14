/**
 * GET /api/dashboard/abandono — Métricas de abandono de leads
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const proyectoId = parseInt(searchParams.get('proyecto_id') || '1');
  const dias = parseInt(searchParams.get('dias') || '90');

  try {
    const { rows } = await pool.query(`
      SELECT
        estado as motivo,
        COUNT(*)::int as total
      FROM pipeline
      WHERE proyecto_id = $1
        AND estado IN ('no_interesa', 'no_contesta')
        AND deleted_at IS NULL
        AND ultimo_cambio >= NOW() - ($2 || ' days')::interval
      GROUP BY estado
      ORDER BY total DESC
    `, [proyectoId, String(dias)]);

    const total = rows.reduce((s: number, r: any) => s + parseInt(r.total), 0);

    return NextResponse.json({
      abandono: rows,
      total_abandonados: total,
      periodo_dias: dias,
    });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
