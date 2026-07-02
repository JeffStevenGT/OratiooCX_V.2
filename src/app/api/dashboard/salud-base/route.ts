/**
 * GET /api/dashboard/salud-base — Salud de datos consolidada
 * Replaces 3 separate calls: abandono + reutilizacion + scoring-contactabilidad
 */
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const proyectoId = parseInt(searchParams.get('proyecto_id') || '1');
  const dias = parseInt(searchParams.get('dias') || '90');

  try {
    const [abandonoRes, reutilRes, scoringRes] = await Promise.all([
      pool.query(`
        SELECT estado as motivo, COUNT(*)::int as total
        FROM pipeline
        WHERE proyecto_id = $1
          AND estado IN ('no_interesa', 'no_contesta')
          AND deleted_at IS NULL
          AND ultimo_cambio >= NOW() - ($2 || ' days')::interval
        GROUP BY estado ORDER BY total DESC
      `, [proyectoId, String(dias)]),
      pool.query('SELECT * FROM tasa_reutilizacion($1, $2)', [proyectoId, dias]),
      pool.query(`
        SELECT nivel as nivel_contacto, COUNT(*)::int as total
        FROM scoring_contactabilidad
        WHERE proyecto_id = $1
        GROUP BY nivel ORDER BY total DESC
      `, [proyectoId]),
    ]);

    const abandono = abandonoRes.rows;
    const total_abandonados = abandono.reduce((s: number, r: any) => s + parseInt(r.total), 0);
    const reutilizacion = reutilRes.rows[0] || { total_registros: 0, reanalizados: 0, tasa: 0, promedio_dias_entre_extracciones: 0 };
    const scoring_contacto = scoringRes.rows;

    return NextResponse.json({
      abandono,
      total_abandonados,
      periodo_dias: dias,
      reutilizacion,
      scoring_contacto,
    });
  } catch (e: any) {
    console.error('[api] salud-base', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
