/**
 * app/api/dashboard/proyecto/route.ts — Dashboard por proyecto
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const proyecto = searchParams.get('proyecto') || 'orange';
  const hoy = new Date().toISOString().split('T')[0];

  try {
    const { rows: [pid] } = await pool.query('SELECT id FROM proyectos WHERE nombre = $1', [proyecto]);
    if (!pid) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    const proyectoId = pid.id;

    // Stats del bot (clientes_proyectos)
    const { rows: [botStats] } = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE datos->>'estado' = 'pendiente') as pendientes,
        COUNT(*) FILTER (WHERE datos->>'estado' = 'en_progreso') as en_progreso,
        COUNT(*) FILTER (WHERE datos->>'estado' = 'completado') as completados,
        COUNT(*) FILTER (WHERE datos->>'estado' = 'no_cliente') as no_cliente,
        COUNT(*) FILTER (WHERE datos->>'estado' = 'error') as errores,
        COUNT(*) FILTER (WHERE datos->>'estado' = 'completado' AND ultima_extraccion::date = $2::date) as completados_hoy
      FROM clientes_proyectos WHERE proyecto_id = $1
    `, [proyectoId, hoy]);

    // Stats comerciales (pipeline)
    const { rows: [pipeStats] } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'pendiente') as asignados,
        COUNT(*) FILTER (WHERE estado = 'contactado') as contactados,
        COUNT(*) FILTER (WHERE estado = 'venta') as ventas
      FROM pipeline WHERE proyecto_id = $1 AND deleted_at IS NULL
    `, [proyectoId]);

    // Sin asignar
    const { rows: [sinAsignar] } = await pool.query(`
      SELECT COUNT(*) as total FROM clientes_proyectos cp
      WHERE cp.proyecto_id = $1 AND cp.datos->>'estado' = 'completado'
        AND NOT EXISTS (SELECT 1 FROM pipeline pl WHERE pl.id_cliente = cp.id_cliente AND pl.proyecto_id = cp.proyecto_id AND pl.deleted_at IS NULL)
    `, [proyectoId]);

    return NextResponse.json({
      totalClientes: parseInt(botStats.total),
      pendientes: parseInt(botStats.pendientes),
      enProgreso: parseInt(botStats.en_progreso),
      completados: parseInt(botStats.completados),
      noCliente: parseInt(botStats.no_cliente),
      errores: parseInt(botStats.errores),
      completadosHoy: parseInt(botStats.completados_hoy),
      sinAsignar: parseInt(sinAsignar.total),
      asignados: parseInt(pipeStats.asignados),
      contactados: parseInt(pipeStats.contactados),
      ventas: parseInt(pipeStats.ventas),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
