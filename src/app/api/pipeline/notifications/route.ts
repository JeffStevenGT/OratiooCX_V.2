/**
 * app/api/pipeline/notifications/route.ts — Badge de notificaciones
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const userRol = searchParams.get('rol');
    if (!userId) return NextResponse.json({ error: 'Falta user_id' }, { status: 400 });

    const proyectoId = 1;
    const uid = parseInt(userId);

    const result: Record<string, number> = {
      nuevos: 0,
      porVencer: 0,
      liberados: 0,
      sinAsignar: 0,
      totalPendientes: 0,
      totalContactados: 0,
    };

    if (userRol === 'asesor') {
      // Leads asignados a este asesor
      const { rows: [r1] } = await pool.query(
        `SELECT COUNT(*) as total FROM pipeline
         WHERE asesor_id = $1 AND proyecto_id = $2
           AND deleted_at IS NULL AND estado = 'pendiente'`,
        [uid, proyectoId]
      );
      result.totalPendientes = parseInt(r1.total);

      // Leads nuevos (asignados en últimas 24h)
      const { rows: [r2] } = await pool.query(
        `SELECT COUNT(*) as total FROM pipeline
         WHERE asesor_id = $1 AND proyecto_id = $2
           AND deleted_at IS NULL AND estado = 'pendiente'
           AND ultimo_cambio > now() - interval '24 hours'`,
        [uid, proyectoId]
      );
      result.nuevos = parseInt(r2.total);

      // Leads por vencer (2+ días sin tocar)
      const { rows: [r3] } = await pool.query(
        `SELECT COUNT(*) as total FROM pipeline
         WHERE asesor_id = $1 AND proyecto_id = $2
           AND deleted_at IS NULL AND estado = 'pendiente'
           AND ultimo_cambio < now() - interval '2 days'`,
        [uid, proyectoId]
      );
      result.porVencer = parseInt(r3.total);

      // Contactados hoy
      const { rows: [r4] } = await pool.query(
        `SELECT COUNT(*) as total FROM pipeline
         WHERE asesor_id = $1 AND proyecto_id = $2
           AND deleted_at IS NULL
           AND estado = 'contactado'
           AND ultimo_cambio::date = current_date`,
        [uid, proyectoId]
      );
      result.totalContactados = parseInt(r4.total);
    }

    if (userRol === 'supervisor' || userRol === 'jefe_area' || userRol === 'desarrollador') {
      // Leads sin asignar
      const { rows: [r5] } = await pool.query(
        `SELECT COUNT(*) as total FROM clientes_proyectos cp
         WHERE cp.proyecto_id = $1
           AND cp.datos->>'estado' = 'completado'
           AND NOT EXISTS (
             SELECT 1 FROM pipeline pl
             WHERE pl.id_cliente = cp.id_cliente
               AND pl.proyecto_id = cp.proyecto_id
               AND pl.deleted_at IS NULL
           )`,
        [proyectoId]
      );
      result.sinAsignar = parseInt(r5.total);

      // Leads liberados hoy
      const { rows: [r6] } = await pool.query(
        `SELECT COUNT(*) as total FROM historial
         WHERE tipo = 'liberacion'
           AND created_at::date = current_date`,
        []
      );
      result.liberados = parseInt(r6.total);
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
