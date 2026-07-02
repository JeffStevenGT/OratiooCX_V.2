/**
 * api/pipeline/estadisticas/route.ts — Estadísticas agregadas (v3: materialized view powered)
 * Uses mv_pipeline_stats for KPIs, porDia, porHora, porAsesor (fast).
 * Keeps live queries only for tiempos (wrap-up, pausas, CDR).
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
    let usuarioJoin = '';
    let usuarioFilter = '';
    if (asesorId) {
      usuarioFilter = ` AND mv.asesor_id = $${pi++}`; params.push(parseInt(asesorId));
    } else if (equipo) {
      usuarioJoin = ` JOIN usuarios u ON mv.asesor_id = u.id`;
      usuarioFilter = ` AND u.equipo = $${pi++}`; params.push(equipo);
    }

    // ── KPIs (from materialized view — instant) ──
    const { rows: [kpi] } = await pool.query(`
      SELECT
        SUM(mv.total_asignados)::int as total_asignados,
        SUM(mv.pendientes)::int as pendientes,
        SUM(mv.contactados)::int as contactados,
        SUM(mv.interesados)::int as interesados,
        SUM(mv.ventas)::int as ventas,
        SUM(mv.no_interesa)::int as no_interesa,
        SUM(mv.no_contesta)::int as no_contesta
      FROM mv_pipeline_stats mv
      ${usuarioJoin}
      WHERE mv.proyecto_id = $1
        AND mv.dia BETWEEN $2 AND $3
        ${usuarioFilter}
    `, params);

    // ── Por día ──
    const { rows: porDia } = await pool.query(`
      SELECT mv.dia,
        SUM(mv.total_asignados)::int as total,
        SUM(mv.contactados)::int as contactados,
        SUM(mv.interesados)::int as interesados,
        SUM(mv.ventas)::int as ventas
      FROM mv_pipeline_stats mv
      ${usuarioJoin}
      WHERE mv.proyecto_id = $1
        AND mv.dia BETWEEN $2 AND $3
        ${usuarioFilter}
      GROUP BY mv.dia ORDER BY mv.dia
    `, params);

    // ── Por asesor ──
    const { rows: porAsesor } = await pool.query(`
      SELECT u.nombre, u.equipo,
        SUM(mv.total_asignados)::int as total,
        SUM(mv.contactados)::int as contactados,
        SUM(mv.ventas)::int as ventas,
        SUM(mv.no_interesa)::int as no_interesa,
        SUM(mv.no_contesta)::int as no_contesta,
        SUM(mv.pendientes)::int as pendientes
      FROM mv_pipeline_stats mv
      JOIN usuarios u ON mv.asesor_id = u.id
      WHERE mv.proyecto_id = $1
        AND mv.dia BETWEEN $2 AND $3
        AND u.rol = 'asesor'
        ${equipo ? ` AND u.equipo = $${pi}` : ''}
      GROUP BY u.id, u.nombre, u.equipo
      ORDER BY ventas DESC
    `, equipo ? [proyectoId, desde, hasta, equipo] : [proyectoId, desde, hasta]);

    // ── Por hora ──
    const { rows: porHora } = await pool.query(`
      SELECT mv.hora,
        SUM(mv.total_asignados)::int as total,
        SUM(mv.contactados)::int as contactados,
        SUM(mv.ventas)::int as ventas
      FROM mv_pipeline_stats mv
      ${usuarioJoin}
      WHERE mv.proyecto_id = $1
        AND mv.dia BETWEEN $2 AND $3
        ${usuarioFilter}
      GROUP BY mv.hora ORDER BY mv.hora
    `, params);

    // ── Tiempos (live — but lighter, only wrap-up + hasta-llamada + pausas + CDR) ──
    const { rows: [wrapUp] } = await pool.query(`
      SELECT
        COALESCE(AVG(EXTRACT(EPOCH FROM (t.created_at - l.created_at)))::int, 0) as segundos_promedio,
        COUNT(*)::int as total_tipificaciones
      FROM historial l
      JOIN historial t ON l.id_cliente = t.id_cliente
        AND t.tipo = 'tipificacion' AND t.created_at > l.created_at
      WHERE l.tipo = 'llamada'
        AND l.proyecto_id = $1
        AND l.created_at::date BETWEEN $2 AND $3
        AND t.created_at::date BETWEEN $2 AND $3
    `, [proyectoId, desde, hasta]);

    const { rows: [tiempoLlamada] } = await pool.query(`
      SELECT
        COALESCE(AVG(EXTRACT(EPOCH FROM (h.created_at - pl.created_at)))::int, 0) as segundos_promedio,
        COUNT(*)::int as total
      FROM pipeline pl
      JOIN LATERAL (
        SELECT created_at FROM historial
        WHERE id_cliente = pl.id_cliente AND tipo = 'llamada' AND proyecto_id = pl.proyecto_id
        ORDER BY created_at ASC LIMIT 1
      ) h ON true
      WHERE pl.proyecto_id = $1
        AND pl.created_at::date BETWEEN $2 AND $3
        AND pl.deleted_at IS NULL
    `, [proyectoId, desde, hasta]);

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

    // ── Llamadas stats ──
    const { rows: [llamadas] } = await pool.query(`
      SELECT
        COUNT(*)::int as total_llamadas,
        COUNT(*) FILTER (WHERE datos->>'resultado' = 'contactado')::int as contestadas,
        COUNT(*) FILTER (WHERE datos->>'resultado' = 'no_contesta')::int as no_contestan,
        COUNT(*) FILTER (WHERE datos->>'resultado' = 'buzon')::int as buzon
      FROM historial
      WHERE tipo = 'llamada' AND proyecto_id = $1 AND created_at::date BETWEEN $2 AND $3
    `, [proyectoId, desde, hasta]);

    // ── Tiempos por asesor (live — needed for wrap_up + hasta_llamar calculations) ──
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
        ${asesorId ? ` AND pl.asesor_id = ${parseInt(asesorId)}` : ''}
        ${equipo ? ` AND u.equipo = '${equipo.replace(/'/g, "''")}'` : ''}
      GROUP BY u.id, u.nombre
      ORDER BY total_llamadas DESC
    `, [proyectoId, desde, hasta]);

    // ── Tiempos operativos (pausas + CDR) ──
    const asesorIds = tiemposAsesor.map((t: any) => t.asesor_id);
    let tiemposOp: Record<number, { pausa_seg?: number; llamada_seg?: number; pausa_count?: number }> = {};
    if (asesorIds.length > 0) {
      const ids = asesorIds.map((_: any, i: number) => `$${i + 4}`);
      const opParams = [proyectoId, desde, hasta, ...asesorIds];
      const { rows: pausaRows } = await pool.query(
        `SELECT usuario_id, COALESCE(SUM(duracion_segundos),0)::int as pausa_seg, COUNT(*)::int as pausa_count
         FROM pausas WHERE inicio::date BETWEEN $2 AND $3 AND fin IS NOT NULL AND usuario_id IN (${ids.join(',')})
         GROUP BY usuario_id`, opParams);
      const { rows: llamadaRows } = await pool.query(
        `SELECT asesor_id, COALESCE(SUM(billsec),0)::int as llamada_seg
         FROM cdr_vpbx WHERE created::date BETWEEN $2 AND $3 AND asesor_id IN (${ids.join(',')})
         GROUP BY asesor_id`, opParams);
      for (const p of pausaRows) tiemposOp[p.usuario_id] = { ...tiemposOp[p.usuario_id], pausa_seg: p.pausa_seg, pausa_count: p.pausa_count };
      for (const l of llamadaRows) tiemposOp[l.asesor_id] = { ...tiemposOp[l.asesor_id], llamada_seg: l.llamada_seg };
    }

    return NextResponse.json({
      kpi: { ...kpi, efectividad, contactabilidad },
      llamadas: llamadas || { total_llamadas: 0, contestadas: 0, no_contestan: 0, buzon: 0 },
      codificacion, hastaLlamada,
      porDia, porAsesor, porHora,
      tiemposAsesor: (tiemposAsesor || []).map((t: any) => {
        const op = tiemposOp[t.asesor_id] || {};
        const ps = op.pausa_seg ?? 0;
        const ls = op.llamada_seg ?? 0;
        const pc = op.pausa_count ?? 0;
        return {
          nombre: t.nombre,
          total_llamadas: t.total_llamadas,
          wrap_up: t.wrap_up_seg > 0 ? fmtTiempo(t.wrap_up_seg) : '--',
          wrap_up_seg: t.wrap_up_seg,
          hasta_llamar: t.hasta_llamar_seg > 0 ? fmtTiempo(t.hasta_llamar_seg) : '--',
          hasta_llamar_seg: t.hasta_llamar_seg,
          pausa: ps > 0 ? fmtTiempo(ps) : '--',
          pausa_seg: ps,
          pausa_count: pc,
          llamada: ls > 0 ? fmtTiempo(ls) : '--',
          llamada_seg: ls,
        };
      }),
      source: 'mv_pipeline_stats',
    });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
