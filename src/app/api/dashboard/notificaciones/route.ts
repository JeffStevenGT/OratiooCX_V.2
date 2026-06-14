/**
 * GET /api/dashboard/notificaciones — Notificaciones del supervisor
 * POST /api/dashboard/notificaciones — Generar notificaciones automáticas
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const supervisorId = searchParams.get('supervisor_id');
  const soloNoLeidas = searchParams.get('no_leidas') !== 'false';

  try {
    let query = `
      SELECT ns.*, u.nombre as asesor_nombre
      FROM notificaciones_supervisor ns
      LEFT JOIN usuarios u ON ns.asesor_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let pi = 1;

    if (supervisorId) {
      query += ` AND ns.supervisor_id = $${pi++}`;
      params.push(parseInt(supervisorId));
    }
    if (soloNoLeidas) {
      query += ` AND ns.leida = false`;
    }
    query += ` ORDER BY ns.created_at DESC LIMIT 50`;

    const { rows } = await pool.query(query, params);

    return NextResponse.json({ notificaciones: rows });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const proyectoId = body.proyecto_id || 1;

  try {
    const generadas: any[] = [];
    const mes = new Date().toISOString().slice(0, 7);
    const hoy = new Date().toISOString().split('T')[0];
    const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Obtener supervisores con sus asesores
    const { rows: supervisores } = await pool.query(
      "SELECT id, nombre FROM usuarios WHERE rol = 'supervisor' AND activo = true"
    );

    for (const sup of supervisores) {
      const { rows: asesores } = await pool.query(
        `SELECT u.id, u.nombre,
           COALESCE(SUM(md.ventas) FILTER (WHERE md.fecha BETWEEN $3 AND $4), 0)::int as ventas_hoy,
           COALESCE(SUM(md.ventas) FILTER (WHERE to_char(md.fecha, 'YYYY-MM') = $5), 0)::int as ventas_mes,
           COALESCE(SUM(md.no_interesa) FILTER (WHERE to_char(md.fecha, 'YYYY-MM') = $5), 0)::int as no_interesa_mes,
           COALESCE(SUM(md.total_llamadas) FILTER (WHERE md.fecha = $4), 0)::int as llamadas_hoy
         FROM usuarios u
         LEFT JOIN metricas_diarias md ON md.asesor_id = u.id AND md.proyecto_id = $1
         WHERE u.supervisor_id = $2 AND u.rol = 'asesor' AND u.activo = true
         GROUP BY u.id, u.nombre`,
        [proyectoId, sup.id, ayer, hoy, mes]
      );

      for (const a of asesores) {
        // Sin ventas hoy
        if (a.ventas_hoy === 0 && a.llamadas_hoy >= 5) {
          const { rows: [existe] } = await pool.query(
            `SELECT id FROM notificaciones_supervisor
             WHERE supervisor_id = $1 AND asesor_id = $2 AND tipo = 'sin_ventas'
               AND created_at::date = $3`,
            [sup.id, a.id, hoy]
          );
          if (!existe) {
            await pool.query(
              `INSERT INTO notificaciones_supervisor (supervisor_id, asesor_id, tipo, titulo, mensaje, datos)
               VALUES ($1, $2, 'sin_ventas', $3, $4, $5)`,
              [sup.id, a.id, `⚠️ ${a.nombre} sin ventas hoy`,
               `${a.nombre} ha hecho ${a.llamadas_hoy} llamadas hoy pero aún no tiene ventas.`,
               JSON.stringify({ ventas: 0, llamadas: a.llamadas_hoy })]
            );
            generadas.push({ supervisor: sup.nombre, asesor: a.nombre, tipo: 'sin_ventas' });
          }
        }

        // Sin actividad
        if (a.llamadas_hoy === 0) {
          const manana = new Date();
          if (manana.getHours() >= 12) {
            const { rows: [existe] } = await pool.query(
              `SELECT id FROM notificaciones_supervisor
               WHERE supervisor_id = $1 AND asesor_id = $2 AND tipo = 'sin_actividad'
                 AND created_at::date = $3`,
              [sup.id, a.id, hoy]
            );
            if (!existe) {
              await pool.query(
                `INSERT INTO notificaciones_supervisor (supervisor_id, asesor_id, tipo, titulo, mensaje, datos)
                 VALUES ($1, $2, 'sin_actividad', $3, $4, $5)`,
                [sup.id, a.id, `🔕 ${a.nombre} sin actividad`,
                 `${a.nombre} no ha hecho ninguna llamada hoy. Revisa si está conectado.`,
                 JSON.stringify({ llamadas: 0 })]
              );
              generadas.push({ supervisor: sup.nombre, asesor: a.nombre, tipo: 'sin_actividad' });
            }
          }
        }

        // Exceso de No Interesa (>40% de leads del mes)
        const { rows: [totalLeads] } = await pool.query(
          `SELECT COALESCE(SUM(leads_asignados), 0)::int as total
           FROM metricas_diarias
           WHERE asesor_id = $1 AND proyecto_id = $2 AND to_char(fecha, 'YYYY-MM') = $3`,
          [a.id, proyectoId, mes]
        );
        const total = totalLeads?.total || 1;
        const ratioNI = Math.round((a.no_interesa_mes / total) * 100);
        if (a.no_interesa_mes >= 10 && ratioNI >= 40) {
          const { rows: [existe] } = await pool.query(
            `SELECT id FROM notificaciones_supervisor
             WHERE supervisor_id = $1 AND asesor_id = $2 AND tipo = 'excede_no_interesa'
               AND created_at::date = $3`,
            [sup.id, a.id, hoy]
          );
          if (!existe) {
            await pool.query(
              `INSERT INTO notificaciones_supervisor (supervisor_id, asesor_id, tipo, titulo, mensaje, datos)
               VALUES ($1, $2, 'excede_no_interesa', $3, $4, $5)`,
              [sup.id, a.id, `🚩 ${a.nombre} excede No Interesa (${ratioNI}%)`,
               `${a.nombre} tiene ${a.no_interesa_mes} "No Interesa" este mes (${ratioNI}% de sus leads). Supera el umbral del 40%.`,
               JSON.stringify({ no_interesa: a.no_interesa_mes, ratio: ratioNI, total })]
            );
            generadas.push({ supervisor: sup.nombre, asesor: a.nombre, tipo: 'excede_no_interesa' });
          }
        }
      }

      // Verificar recuperaciones: asesores que tenían bajo rendimiento y mejoraron
      const { rows: recuperados } = await pool.query(`
        SELECT DISTINCT u.nombre
        FROM metricas_diarias md
        JOIN usuarios u ON md.asesor_id = u.id
        WHERE u.supervisor_id = $1 AND md.proyecto_id = $2
          AND md.fecha = $3 AND md.ventas > 0
          AND EXISTS (
            SELECT 1 FROM metricas_diarias md2
            WHERE md2.asesor_id = md.asesor_id AND md2.proyecto_id = md.proyecto_id
              AND md2.fecha = $4 AND md2.ventas = 0 AND md2.total_llamadas >= 5
          )
      `, [sup.id, proyectoId, hoy, ayer]);

      for (const r of recuperados) {
        const { rows: [existe] } = await pool.query(
          `SELECT id FROM notificaciones_supervisor
           WHERE supervisor_id = $1 AND tipo = 'recuperacion' AND created_at::date = $2`,
          [sup.id, hoy]
        );
        if (!existe) {
          await pool.query(
            `INSERT INTO notificaciones_supervisor (supervisor_id, tipo, titulo, mensaje, datos)
             VALUES ($1, 'recuperacion', $2, $3, $4)`,
            [sup.id, `🔄 Recuperación en el equipo`,
             `¡${r.nombre} volvió a vender hoy después de un mal día ayer! Buen trabajo.`,
             JSON.stringify({ asesor: r.nombre })]
          );
          generadas.push({ supervisor: sup.nombre, asesor: r.nombre, tipo: 'recuperacion' });
        }
      }

      // Verificar caídas de métricas (umbrales de Yone)
      const { rows: [metricasActual] } = await pool.query(`
        SELECT
          COALESCE(AVG(CASE WHEN leads_asignados > 0 THEN leads_contactados::numeric / leads_asignados END), 0) as contactabilidad,
          COALESCE(AVG(CASE WHEN leads_contactados > 0 THEN ventas::numeric / leads_contactados END), 0) as efectividad
        FROM metricas_diarias
        WHERE proyecto_id = $1 AND fecha >= CURRENT_DATE - 7
      `, [proyectoId]);

      const { rows: [metricasAnterior] } = await pool.query(`
        SELECT
          COALESCE(AVG(CASE WHEN leads_asignados > 0 THEN leads_contactados::numeric / leads_asignados END), 0) as contactabilidad,
          COALESCE(AVG(CASE WHEN leads_contactados > 0 THEN ventas::numeric / leads_contactados END), 0) as efectividad
        FROM metricas_diarias
        WHERE proyecto_id = $1 AND fecha BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE - 8
      `, [proyectoId]);

      const contactActual = parseFloat(metricasActual?.contactabilidad || '0');
      const contactAnterior = parseFloat(metricasAnterior?.contactabilidad || '0');
      const efectActual = parseFloat(metricasActual?.efectividad || '0');
      const efectAnterior = parseFloat(metricasAnterior?.efectividad || '0');

      // Caída contactabilidad >15%
      if (contactAnterior > 0 && contactActual < contactAnterior * 0.85) {
        const { rows: [existe] } = await pool.query(
          `SELECT id FROM notificaciones_supervisor
           WHERE supervisor_id = $1 AND tipo = 'caida_contactabilidad' AND created_at::date = $2`,
          [sup.id, hoy]
        );
        if (!existe) {
          await pool.query(
            `INSERT INTO notificaciones_supervisor (supervisor_id, tipo, titulo, mensaje, datos)
             VALUES ($1, 'caida_contactabilidad', $2, $3, $4)`,
            [sup.id,
             `📉 Caída de contactabilidad`,
             `La contactabilidad bajó del ${Math.round(contactAnterior * 100)}% al ${Math.round(contactActual * 100)}% esta semana. Umbral superado (>15% de caída). Revisa la calidad de los datos.`,
             JSON.stringify({ actual: Math.round(contactActual * 100), anterior: Math.round(contactAnterior * 100), caida: Math.round((1 - contactActual / contactAnterior) * 100) })]
          );
          generadas.push({ supervisor: sup.nombre, tipo: 'caida_contactabilidad' });
        }
      }

      // Caída conversión >20%
      if (efectAnterior > 0 && efectActual < efectAnterior * 0.80) {
        const { rows: [existe] } = await pool.query(
          `SELECT id FROM notificaciones_supervisor
           WHERE supervisor_id = $1 AND tipo = 'caida_conversion' AND created_at::date = $2`,
          [sup.id, hoy]
        );
        if (!existe) {
          await pool.query(
            `INSERT INTO notificaciones_supervisor (supervisor_id, tipo, titulo, mensaje, datos)
             VALUES ($1, 'caida_conversion', $2, $3, $4)`,
            [sup.id,
             `📉 Caída de conversión`,
             `La conversión (contacto→venta) bajó del ${Math.round(efectAnterior * 100)}% al ${Math.round(efectActual * 100)}% esta semana. Umbral superado (>20% de caída).`,
             JSON.stringify({ actual: Math.round(efectActual * 100), anterior: Math.round(efectAnterior * 100), caida: Math.round((1 - efectActual / efectAnterior) * 100) })]
          );
          generadas.push({ supervisor: sup.nombre, tipo: 'caida_conversion' });
        }
      }
    }

    return NextResponse.json({ generadas, total: generadas.length });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  // Marcar como leída
  const body = await req.json().catch(() => ({}));
  const id = body.id;
  const todas = body.todas;
  const supervisorId = body.supervisor_id;

  try {
    if (todas && supervisorId) {
      await pool.query(
        'UPDATE notificaciones_supervisor SET leida = true WHERE supervisor_id = $1 AND leida = false',
        [parseInt(supervisorId)]
      );
      return NextResponse.json({ ok: true, marcadas: 'todas' });
    }
    if (id) {
      await pool.query(
        'UPDATE notificaciones_supervisor SET leida = true WHERE id = $1',
        [parseInt(id)]
      );
      return NextResponse.json({ ok: true, marcadas: 1 });
    }
    return NextResponse.json({ error: 'Especifica id o todas+supervisor_id' }, { status: 400 });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
