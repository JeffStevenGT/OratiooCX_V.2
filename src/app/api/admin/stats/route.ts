/**
 * app/api/admin/stats/route.ts — Métricas del sistema
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [clientes, pendientes, completados, errores, maquinas, workers] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM clientes'),
      pool.query("SELECT COUNT(*) FROM clientes_proyectos WHERE datos->>'estado' = 'pendiente' AND proyecto_id = 1"),
      pool.query("SELECT COUNT(*) FROM clientes_proyectos WHERE datos->>'estado' = 'completado' AND proyecto_id = 1"),
      pool.query("SELECT COUNT(*) FROM clientes_proyectos WHERE datos->>'estado' = 'error' AND proyecto_id = 1"),
      pool.query("SELECT COUNT(*) FROM maquinas WHERE estado = 'online'"),
      pool.query("SELECT COALESCE(SUM(workers_activos),0) FROM maquinas WHERE estado = 'online'"),
    ]);

    return NextResponse.json({
      totalClientes: parseInt(clientes.rows[0].count),
      pendientes: parseInt(pendientes.rows[0].count),
      completados: parseInt(completados.rows[0].count),
      errores: parseInt(errores.rows[0].count),
      maquinasOnline: parseInt(maquinas.rows[0].count),
      workersActivos: parseInt(workers.rows[0].count || '0'),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
