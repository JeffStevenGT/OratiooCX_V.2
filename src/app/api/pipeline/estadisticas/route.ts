/**
 * api/pipeline/estadisticas/route.ts — Estadísticas agregadas para supervisor
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const desde = searchParams.get('desde') || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const hasta = searchParams.get('hasta') || new Date().toISOString().split('T')[0];
    const equipo = searchParams.get('equipo') || '';
    const asesorId = searchParams.get('asesor_id') || '';

    const proyectoId = parseInt(searchParams.get('proyecto_id') || '1');
    const params: any[] = [proyectoId, desde, hasta];
    let pi = 4;

    let asesorFilter = '';
    if (asesorId) { asesorFilter = ` AND pl.asesor_id = $${pi++}`; params.push(parseInt(asesorId)); }
    else if (equipo) { asesorFilter = ` AND u.equipo = $${pi++}`; params.push(equipo); }

    // ── KPIs de pipeline ──
    const { rows: [kpi] } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE pl.estado = 'pendiente')::int as pendientes,
        COUNT(*) FILTER (WHERE pl.estado = 'contactado')::int as contactados,
        COUNT(*) FILTER (WHERE pl.estado IN ('interesado','negociacion'))::int as interesados,
        COUNT(*) FILTER (WHERE pl.estado = 'venta')::int as ventas,
        COUNT(*) FILTER (WHERE pl.estado = 'no_interesa')::int as no_interesa,
        COUNT(*) FILTER (WHERE pl.estado = 'no_contesta')::int as no_contesta,
        COUNT(*)::int as total_asignados
      FROM pipeline pl
      JOIN usuarios u ON pl.asesor_id = u.id
      WHERE pl.proyecto_id = $1
        AND pl.created_at::date BETWEEN $2 AND $3
        AND pl.deleted_at IS NULL
        ${asesorFilter}
    `, params);

    // ── Tiempo de codificación (wrap-up): gap entre llamada y tipificación ──
    const { rows: [wrapUp] } = await pool.query(`
      SELECT
        COALESCE(AVG(EXTRACT(EPOCH FROM (t.created_at - l.created_at)))::int, 0) as segundos_promedio,
        COUNT(*)::int as total_tipificaciones
      FROM historial l
      JOIN historial t ON l.id_cliente = t.id_cliente
        AND t.tipo = 'tipificacion'
        AND t.created_at > l.created_at
      WHERE l.tipo = 'llamada'
        AND l.proyecto_id = $1
        AND l.created_at::date BETWEEN $2 AND $3
        AND t.created_at::date BETWEEN $2 AND $3
    `, [proyectoId, desde, hasta]);

    // ── Tiempo hasta primera llamada (asignación → primer intento) ──
    const { rows: [tiempoLlamada] } = await pool.query(`
      SELECT
        COALESCE(AVG(EXTRACT(EPOCH FROM (h.created_at - pl.created_at)))::int, 0) as segundos_promedio,
        COUNT(*)::int as total
      FROM pipeline pl
      JOIN LATERAL (
        SELECT created_at FROM historial
        WHERE id_cliente = pl.id_cliente
          AND tipo = 'llamada'
          AND proyecto_id = pl.proyecto_id
        ORDER BY created_at ASC LIMIT 1
      ) h ON true
      WHERE pl.proyecto_id = $1
        AND pl.created_at::date BETWEEN $2 AND $3
        AND pl.deleted_at IS NULL
    `, [proyectoId, desde, hasta]);

    // Formatear tiempos
    const fmtTiempo = (seg: number) => {
      if (seg < 60) return `${seg}s`;
      if (seg < 3600) return `${Math.round(seg / 60)}min`;
      return `${Math.round(seg / 3600)}h ${Math.round((seg % 3600) / 60)}min`;
    };

    const codificacion = {
      promedio: wrapUp?.total_tipificaciones > 0 ? fmtTiempo(wrapUp.segundos_promedio) : '—',
      segundos: wrapUp?.segundos_promedio || 0,
      total: wrapUp?.total_tipificaciones || 0,
    };

    const hastaLlamada = {
      promedio: tiempoLlamada?.total > 0 ? fmtTiempo(tiempoLlamada.segundos_promedio) : '—',
      segundos: tiempoLlamada?.segundos_promedio || 0,
      total: tiempoLlamada?.total || 0,
    };
    const total = (kpi?.total_asignados || 1);
    const efectividad = Math.round(((kpi?.ventas || 0) / total) * 100);
    const contactabilidad = Math.round(((kpi?.contactados || 0) / total) * 100);

    // ── Intentos de llamada ──
    const { rows: [llamadas] } = await pool.query(`
      SELECT
        COUNT(*)::int as total_llamadas,
        COUNT(*) FILTER (WHERE datos->>'resultado' = 'contactado')::int as contestadas,
        COUNT(*) FILTER (WHERE datos->>'resultado' = 'no_contesta')::int as no_contestan,
        COUNT(*) FILTER (WHERE datos->>'resultado' = 'buzon')::int as buzon
      FROM historial
      WHERE tipo = 'llamada'
        AND proyecto_id = $1
        AND created_at::date BETWEEN $2 AND $3
    `, [proyectoId, desde, hasta]);

    // ── Por día (para gráfico) ──
    const { rows: porDia } = await pool.query(`
      SELECT
        created_at::date as dia,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE estado = 'contactado')::int as contactados,
        COUNT(*) FILTER (WHERE estado IN ('interesado','negociacion'))::int as interesados,
        COUNT(*) FILTER (WHERE estado = 'venta')::int as ventas
      FROM pipeline pl
      WHERE pl.proyecto_id = $1
        AND pl.created_at::date BETWEEN $2 AND $3
        AND pl.deleted_at IS NULL
        ${asesorFilter}
      GROUP BY dia ORDER BY dia
    `, params);

    // ── Por asesor ──
    const { rows: porAsesor } = await pool.query(`
      SELECT u.nombre, u.equipo,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE pl.estado = 'contactado')::int as contactados,
        COUNT(*) FILTER (WHERE pl.estado = 'venta')::int as ventas,
        COUNT(*) FILTER (WHERE pl.estado = 'no_interesa')::int as no_interesa,
        COUNT(*) FILTER (WHERE pl.estado = 'no_contesta')::int as no_contesta,
        COUNT(*) FILTER (WHERE pl.estado = 'pendiente')::int as pendientes
      FROM pipeline pl
      JOIN usuarios u ON pl.asesor_id = u.id
      WHERE pl.proyecto_id = $1
        AND pl.created_at::date BETWEEN $2 AND $3
        AND pl.deleted_at IS NULL
        AND u.rol = 'asesor'
        ${asesorFilter}
      GROUP BY u.id, u.nombre, u.equipo
      ORDER BY ventas DESC
    `, params);

    // ── Por hora del día ──
    const { rows: porHora } = await pool.query(`
      SELECT
        EXTRACT(HOUR FROM pl.created_at)::int as hora,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE pl.estado = 'contactado')::int as contactados,
        COUNT(*) FILTER (WHERE pl.estado = 'venta')::int as ventas
      FROM pipeline pl
      JOIN usuarios u ON pl.asesor_id = u.id
      WHERE pl.proyecto_id = $1
        AND pl.created_at::date BETWEEN $2 AND $3
        AND pl.deleted_at IS NULL
        ${asesorFilter}
      GROUP BY hora ORDER BY hora
    `, params);

    // Tiempos por asesor
    const { rows: tiemposAsesor } = await pool.query(`
      SELECT u.id as asesor_id, u.nombre,
        COUNT(DISTINCT l.id)::int as total_llamadas,
        COALESCE(AVG(EXTRACT(EPOCH FROM (t.created_at - l.created_at))) FILTER (WHERE t.id IS NOT NULL)::int, 0) as wrap_up_seg,
        COALESCE(AVG(EXTRACT(EPOCH FROM (l.created_at - pl.created_at)))::int, 0) as hasta_llamar_seg
      FROM pipeline pl
      JOIN usuarios u ON pl.asesor_id = u.id AND u.rol = 'asesor'
      LEFT JOIN LATERAL (
        SELECT id, created_at FROM historial
        WHERE id_cliente = pl.id_cliente AND tipo = 'llamada' AND proyecto_id = pl.proyecto_id
        ORDER BY created_at ASC LIMIT 1
      ) l ON true
      LEFT JOIN LATERAL (
        SELECT id, created_at FROM historial
        WHERE id_cliente = pl.id_cliente AND tipo = 'tipificacion' AND proyecto_id = pl.proyecto_id
          AND created_at > l.created_at
        ORDER BY created_at ASC LIMIT 1
      ) t ON true
      WHERE pl.proyecto_id = $1
        AND pl.created_at::date BETWEEN $2 AND $3
        AND pl.deleted_at IS NULL
        ${asesorFilter}
      GROUP BY u.id, u.nombre
      ORDER BY total_llamadas DESC
    `, [proyectoId, desde, hasta]);

    // ── Tiempos operativos (pausas + llamadas desde pausas + cdr_vpbx) ──
    const asesorIds = tiemposAsesor.map((t: any) => t.asesor_id);
    let tiemposOp: Record<number, { pausa_seg: number; llamada_seg: number; pausa_count: number }> = {};
    
    if (asesorIds.length > 0) {
      const ids = asesorIds.map((_: any, i: number) => `$${i + 4}`);
      const opParams = [proyectoId, desde, hasta, ...asesorIds];

      // Tiempo en pausa
      const { rows: pausaRows } = await pool.query(
        `SELECT usuario_id, COALESCE(SUM(duracion_segundos),0)::int as pausa_seg, COUNT(*)::int as pausa_count
         FROM pausas
         WHERE inicio::date BETWEEN $2 AND $3 AND fin IS NOT NULL
           AND usuario_id IN (${ids.join(',')})
         GROUP BY usuario_id`,
        opParams
      );

      // Tiempo en llamada (billsec de CDR)
      const { rows: llamadaRows } = await pool.query(
        `SELECT asesor_id, COALESCE(SUM(billsec),0)::int as llamada_seg
         FROM cdr_vpbx
         WHERE created::date BETWEEN $2 AND $3
           AND asesor_id IN (${ids.join(',')})
         GROUP BY asesor_id`,
        opParams
      );

      for (const p of pausaRows) tiemposOp[p.usuario_id] = { ...tiemposOp[p.usuario_id], pausa_seg: p.pausa_seg, pausa_count: p.pausa_count };
      for (const l of llamadaRows) tiemposOp[l.asesor_id] = { ...tiemposOp[l.asesor_id], llamada_seg: l.llamada_seg };
    }

    return NextResponse.json({
      kpi: { ...kpi, efectividad, contactabilidad },
      llamadas: llamadas || { total_llamadas: 0, contestadas: 0, no_contestan: 0, buzon: 0 },
      codificacion,
      hastaLlamada,
      porDia,
      porAsesor,
      porHora,
      tiemposAsesor: (tiemposAsesor || []).map((t: any) => {
        const op = tiemposOp[t.asesor_id] || {};
        return {
          nombre: t.nombre,
          total_llamadas: t.total_llamadas,
          wrap_up: t.wrap_up_seg > 0 ? fmtTiempo(t.wrap_up_seg) : '--',
          wrap_up_seg: t.wrap_up_seg,
          hasta_llamar: t.hasta_llamar_seg > 0 ? fmtTiempo(t.hasta_llamar_seg) : '--',
          hasta_llamar_seg: t.hasta_llamar_seg,
          pausa: (op.pausa_seg || 0) > 0 ? fmtTiempo(op.pausa_seg) : '--',
          pausa_seg: op.pausa_seg || 0,
          pausa_count: op.pausa_count || 0,
          llamada: (op.llamada_seg || 0) > 0 ? fmtTiempo(op.llamada_seg) : '--',
          llamada_seg: op.llamada_seg || 0,
        };
      }),
    });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
