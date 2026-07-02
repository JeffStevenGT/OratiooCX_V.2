/**
 * GET /api/dashboard/supervisor-equipo — Batch stats for all asesores
 * Replaces N individual /api/pipeline/notifications?user_id=X calls (N+1 problem)
 *
 * Returns: [{ id, nombre, equipo, pendientes, contactados, porVencer }]
 */
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const proyectoId = parseInt(searchParams.get('proyecto_id') || '1');

    const { rows } = await pool.query(`
      SELECT
        u.id,
        u.nombre,
        u.equipo,
        COUNT(*) FILTER (WHERE pl.estado = 'pendiente')::int as pendientes,
        COUNT(*) FILTER (WHERE pl.estado = 'contactado'
          AND pl.ultimo_cambio::date = current_date)::int as contactados,
        COUNT(*) FILTER (WHERE pl.estado = 'pendiente'
          AND pl.ultimo_cambio < now() - interval '2 days')::int as "porVencer"
      FROM usuarios u
      LEFT JOIN pipeline pl
        ON pl.asesor_id = u.id
        AND pl.proyecto_id = $1
        AND pl.deleted_at IS NULL
      WHERE u.rol = 'asesor'
        AND u.activo = true
      GROUP BY u.id, u.nombre, u.equipo
      ORDER BY u.nombre
    `, [proyectoId]);

    return NextResponse.json(rows);
  } catch (e: any) {
    console.error('[api] supervisor-equipo', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
