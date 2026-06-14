/**
 * app/api/pipeline/release-stale/route.ts — Ciclo de cooldown y liberación
 * ========================================================================
 * Lógica de cadencia de contacto por RONDAS (no por llamadas individuales):
 *   - Una ronda = todas las llamadas a los números del lead en una sesión
 *   - Nueva ronda solo si pasó el cooldown (48h) desde la última
 *   - Dentro de la misma ronda, el asesor puede llamar a todos los números
 *   - Cierra leads con 5+ RONDAS fallidas
 *
 * Se ejecuta vía cron (cada hora + validación nocturna).
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { dias = 3 } = await req.json().catch(() => ({}));
    const proyectoId = 1; // Internal cleanup, always runs against all projects
    let reactivados = 0;
    let cerrados = 0;
    let liberados = 0;

    // ── 1. Reactivar leads con callback vencido ──
    const { rows: callbacks } = await pool.query(`
      SELECT id FROM pipeline
      WHERE proyecto_id = $1
        AND deleted_at IS NULL
        AND estado = 'no_contesta'
        AND callback_at IS NOT NULL
        AND callback_at <= now()
    `, [proyectoId]);

    const ids = callbacks.map(c => c.id);
    if (ids.length > 0) {
      await pool.query(
        `UPDATE pipeline SET estado = 'pendiente', ultimo_cambio = now(), callback_at = NULL
         WHERE id = ANY($1::int[])`,
        [ids]
      );
      reactivados += ids.length;
    }

    // ── 2. Leads pendientes: actualizar rondas según cooldown ──
    const COOLDOWN_HORAS = 48;
    const MAX_RONDAS = 5;

    const { rows: pendientes } = await pool.query(`
      SELECT pl.id, pl.asesor_id, pl.ronda_actual, pl.ultimo_intento_ronda, pl.id_cliente
      FROM pipeline pl
      WHERE pl.proyecto_id = $1
        AND pl.deleted_at IS NULL
        AND pl.estado = 'pendiente'
    `, [proyectoId]);

    for (const p of pendientes) {
      const rondaActual = p.ronda_actual || 1;
      const ultimoIntento = p.ultimo_intento_ronda;

      // Verificar si pasó el cooldown → iniciar nueva ronda
      if (ultimoIntento) {
        const horasDesdeUltimo = (Date.now() - new Date(ultimoIntento).getTime()) / (1000 * 60 * 60);
        if (horasDesdeUltimo >= COOLDOWN_HORAS) {
          await pool.query(
            `UPDATE pipeline SET ronda_actual = ronda_actual + 1, ultimo_intento_ronda = NULL WHERE id = $1`,
            [p.id]
          );
        }
      }

      // Cerrar leads con 5+ rondas fallidas
      const { rows: [check] } = await pool.query(
        `SELECT ronda_actual FROM pipeline WHERE id = $1`,
        [p.id]
      );
      const rondas = check?.ronda_actual || rondaActual;

      if (rondas >= MAX_RONDAS) {
        const { rows: [cp] } = await pool.query(
          `SELECT datos FROM clientes_proyectos WHERE id_cliente = $1 AND proyecto_id = $2`,
          [p.id_cliente, proyectoId]
        );
        const datos = cp?.datos || {};
        const cima = datos?.cima_global ? 'SI' : 'NO';
        const lineas = datos?.lineas || [];
        const tieneRenove = lineas.some((l: any) => l.tiene_renove);

        await pool.query(
          `INSERT INTO analisis_perdidos (id_cliente, proyecto_id, asesor_id, estado_final, intentos_totales, cima_al_cierre, renove_al_cierre, lineas_al_cierre)
           SELECT id_cliente, $1, asesor_id, 'no_contesta', $2, $3, $4, $5
           FROM pipeline WHERE id = $6`,
          [proyectoId, rondas, cima, tieneRenove, lineas.length, p.id]
        );

        await pool.query(
          `UPDATE pipeline SET estado = 'no_contesta', ultimo_cambio = now() WHERE id = $1`,
          [p.id]
        );
        cerrados++;
      }
    }

    // ── 3. Liberar leads nunca contactados (>N días sin tocar) ──
    const { rows: inactivos } = await pool.query(
      `SELECT pl.id, pl.id_cliente, pl.asesor_id, u.nombre as asesor_nombre
       FROM pipeline pl
       JOIN usuarios u ON pl.asesor_id = u.id
       WHERE pl.proyecto_id = $1
         AND pl.estado = 'pendiente'
         AND pl.deleted_at IS NULL
         AND pl.ultimo_cambio < now() - ($2 || ' days')::interval
         AND COALESCE(pl.ronda_actual, 1) <= 1`,
      [proyectoId, String(dias)]
    );

    for (const lead of inactivos) {
      await pool.query(`UPDATE pipeline SET deleted_at = now() WHERE id = $1`, [lead.id]);
      await pool.query(
        `INSERT INTO historial (id_cliente, tipo, proyecto_id, asesor_id, descripcion, datos)
         VALUES ($1, 'liberacion', $2, $3, $4, $5)`,
        [lead.id_cliente, proyectoId, lead.asesor_id,
         `Lead liberado por inactividad (${dias} días sin tocar, 0 intentos)`,
         JSON.stringify({ asesor_anterior: lead.asesor_nombre, dias_inactivo: dias })]
      );
      liberados++;
    }

    return NextResponse.json({
      reactivados, cerrados, liberados,
      mensaje: `${reactivados} reactivados, ${cerrados} cerrados, ${liberados} liberados`,
    });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
