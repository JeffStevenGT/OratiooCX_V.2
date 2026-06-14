/**
 * API /api/fichajes/equipo — Vista de fichajes del equipo (supervisor/jefe/dev/bo/it)
 * =========================================================================
 * GET — Resumen de fichajes del día del equipo con cruce de pausas
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-roles';
import pool from '@/lib/db';

const ROLES_EQUIPO = ['supervisor', 'jefe_area', 'desarrollador', 'it', 'back_office'];

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userRole = (session.user as any).role;
    const userId = parseInt((session.user as any).id);
    const userEquipo = (session.user as any).team;

    if (!ROLES_EQUIPO.includes(userRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const fecha = searchParams.get('fecha');        // ISO start of day local
    const fechaFin = searchParams.get('fecha_fin');  // ISO end of day local

    // Filtro timezone-safe: usa rango de timestamps en vez de ::date
    const fechaInicio = fecha || new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
    const fechaFinal = fechaFin || new Date().toISOString().split('T')[0] + 'T23:59:59.999Z';

    // Determinar qué usuarios mostrar (supervisor solo su equipo)
    let userFilter = '';
    let params: any[] = [fechaInicio, fechaFinal];
    let paramIdx = 3;

    if (userRole === 'supervisor') {
      userFilter = ` AND (u.supervisor_id = $2 OR u.id = $2)`;
      params.push(userId);
      paramIdx++;
    } else if (userRole === 'back_office') {
      // BO ve todos en modo solo lectura
    }

    // Fichajes del día por usuario
    const { rows } = await pool.query(`
      WITH fichajes_hoy AS (
        SELECT usuario_id, tipo, timestamp,
          ROW_NUMBER() OVER (PARTITION BY usuario_id ORDER BY timestamp) as rn_asc,
          ROW_NUMBER() OVER (PARTITION BY usuario_id ORDER BY timestamp DESC) as rn_desc
        FROM fichajes
        WHERE timestamp >= $1::timestamptz AND timestamp < $2::timestamptz
      ),
      entradas AS (
        SELECT usuario_id, timestamp as entrada
        FROM fichajes_hoy WHERE tipo = 'entrada' AND rn_asc = 1
      ),
      ultima_salida AS (
        SELECT usuario_id, timestamp as salida
        FROM fichajes_hoy WHERE tipo = 'salida' AND rn_desc = 1
      ),
      pausas_hoy AS (
        SELECT usuario_id,
          SUM(EXTRACT(EPOCH FROM (fin - inicio))) as segundos_pausa
        FROM pausas
        WHERE inicio >= $1::timestamptz AND inicio < $2::timestamptz AND fin IS NOT NULL
        GROUP BY usuario_id
      )
      SELECT u.id, u.nombre, u.email, u.equipo, u.activo,
        e.entrada, s.salida,
        COALESCE(p.segundos_pausa, 0) as segundos_pausa,
        COALESCE(EXTRACT(EPOCH FROM (COALESCE(s.salida, NOW()::timestamptz) - e.entrada)), 0) - COALESCE(p.segundos_pausa, 0) as segundos_trabajados,
        CASE WHEN e.entrada IS NULL THEN 'sin_fichar'
             WHEN s.salida IS NULL THEN 'trabajando'
             ELSE 'completado'
        END as estado
      FROM usuarios u
      LEFT JOIN entradas e ON e.usuario_id = u.id
      LEFT JOIN ultima_salida s ON s.usuario_id = u.id
      LEFT JOIN pausas_hoy p ON p.usuario_id = u.id
      WHERE u.activo = true ${userFilter}
      ORDER BY u.nombre
    `, params);

    return NextResponse.json(rows);
  } catch (e: any) {
    if (e.message === 'No autenticado') return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    console.error('[api/fichajes/equipo]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
