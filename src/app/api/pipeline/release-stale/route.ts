/**
 * app/api/pipeline/release-stale/route.ts — Liberar leads inactivos
 * ==================================================================
 * Devuelve al pool los leads en 'pendiente' que llevan N días sin tocar.
 * Se ejecuta vía cron nocturno.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { dias = 3 } = await req.json().catch(() => ({}));
    const proyectoId = 1;

    // Buscar leads inactivos
    const { rows: inactivos } = await pool.query(
      `SELECT pl.id, pl.id_cliente, pl.asesor_id, u.nombre as asesor_nombre
       FROM pipeline pl
       JOIN usuarios u ON pl.asesor_id = u.id
       WHERE pl.proyecto_id = $1
         AND pl.estado = 'pendiente'
         AND pl.deleted_at IS NULL
         AND pl.ultimo_cambio < now() - ($2 || ' days')::interval`,
      [proyectoId, String(dias)]
    );

    let count = 0;
    for (const lead of inactivos) {
      // Soft delete
      await pool.query(
        `UPDATE pipeline SET deleted_at = now() WHERE id = $1`,
        [lead.id]
      );

      // Registrar en historial
      await pool.query(
        `INSERT INTO historial (id_cliente, tipo, proyecto_id, asesor_id, descripcion, datos)
         VALUES ($1, 'liberacion', $2, $3, $4, $5)`,
        [lead.id_cliente, proyectoId, lead.asesor_id,
         `Lead liberado automáticamente por inactividad (${dias} días sin tocar)`,
         JSON.stringify({ asesor_anterior: lead.asesor_nombre, dias_inactivo: dias })]
      );

      count++;
    }

    return NextResponse.json({
      liberados: count,
      mensaje: `${count} leads liberados por inactividad (>${dias} días)`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
