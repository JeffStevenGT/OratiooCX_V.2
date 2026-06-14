/**
 * GET /api/dashboard/rendimiento — Rendimiento Unificado de Operadores
 * Fase 7 — Inteligencia Comercial
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const desde = searchParams.get('desde') || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const hasta = searchParams.get('hasta') || new Date().toISOString().split('T')[0];
  const proyectoId = parseInt(searchParams.get('proyecto_id') || '1');
  const equipo = searchParams.get('equipo') || '';
  const asesorId = searchParams.get('asesor_id') || '';
  const mes = searchParams.get('mes') || new Date().toISOString().slice(0, 7); // "YYYY-MM"

  try {
    const params: any[] = [proyectoId, desde, hasta];
    let pi = 4;

    let asesorFilter = '';
    if (asesorId) { asesorFilter = ` AND md.asesor_id = $${pi++}`; params.push(parseInt(asesorId)); }
    else if (equipo) { asesorFilter = ` AND u.equipo = $${pi++}`; params.push(equipo); }

    // ── 1. Métricas diarias agregadas ──
    const { rows: diarias } = await pool.query(`
      SELECT
        md.fecha,
        SUM(md.leads_asignados)::int as asignados,
        SUM(md.leads_contactados)::int as contactados,
        SUM(md.ventas)::int as ventas,
        SUM(md.total_llamadas)::int as llamadas,
        SUM(md.llamadas_contestadas)::int as contestadas,
        SUM(md.segundos_hablados)::int as seg_hablados,
        SUM(md.segundos_conectado)::int as seg_conectado
      FROM metricas_diarias md
      JOIN usuarios u ON md.asesor_id = u.id
      WHERE md.proyecto_id = $1
        AND md.fecha BETWEEN $2 AND $3
        ${asesorFilter}
      GROUP BY md.fecha ORDER BY md.fecha
    `, params);

    // ── 2. Por asesor (agregado del período) ──
    const { rows: porAsesor } = await pool.query(`
      SELECT
        u.id, u.nombre, u.equipo, u.extension_vpbx,
        SUM(md.leads_asignados)::int as asignados,
        SUM(md.leads_contactados)::int as contactados,
        SUM(md.ventas)::int as ventas,
        SUM(md.no_interesa)::int as no_interesa,
        SUM(md.no_contesta)::int as no_contesta,
        SUM(md.total_llamadas)::int as total_llamadas,
        SUM(md.llamadas_contestadas)::int as llamadas_contestadas,
        SUM(md.segundos_hablados)::int as seg_hablados,
        SUM(md.segundos_conectado)::int as seg_conectado,
        COALESCE(AVG(md.wrap_up_promedio_seg) FILTER (WHERE md.wrap_up_promedio_seg > 0)::int, 0) as wrap_up_promedio,
        COALESCE(AVG(md.hasta_llamar_promedio_seg) FILTER (WHERE md.hasta_llamar_promedio_seg > 0)::int, 0) as hasta_llamar_promedio,
        COALESCE(AVG(md.puntuacion_calidad) FILTER (WHERE md.puntuacion_calidad > 0)::numeric(3,1), 0) as calidad_promedio
      FROM metricas_diarias md
      JOIN usuarios u ON md.asesor_id = u.id AND u.activo = true
      WHERE md.proyecto_id = $1
        AND md.fecha BETWEEN $2 AND $3
        ${asesorFilter}
      GROUP BY u.id, u.nombre, u.equipo, u.extension_vpbx
      ORDER BY ventas DESC
    `, params);

    // ── 3. Por hora del día ──
    const { rows: porHora } = await pool.query(`
      SELECT
        EXTRACT(HOUR FROM h.created_at)::int as hora,
        COUNT(*)::int as total_llamadas,
        COUNT(*) FILTER (WHERE h.datos->>'resultado' = 'contactado')::int as contestadas,
        COUNT(DISTINCT h.asesor_id)::int as asesores_activos
      FROM historial h
      WHERE h.tipo = 'llamada'
        AND h.proyecto_id = $1
        AND h.created_at::date BETWEEN $2 AND $3
      GROUP BY hora ORDER BY hora
    `, [proyectoId, desde, hasta]);

    // ── 4. Cinturones por asesor ──
    const cinturones: any[] = [];
    for (const a of porAsesor) {
      const { rows: [c] } = await pool.query(
        'SELECT * FROM cinturon_actual($1, $2)',
        [a.id, mes]
      );
      if (c) {
        cinturones.push({ asesor_id: a.id, ...c });
      }
    }

    // ── 5. KPIs globales del período ──
    const { rows: [global] } = await pool.query(`
      SELECT
        SUM(md.leads_asignados)::int as total_asignados,
        SUM(md.leads_contactados)::int as total_contactados,
        SUM(md.ventas)::int as total_ventas,
        SUM(md.total_llamadas)::int as total_llamadas,
        SUM(md.llamadas_contestadas)::int as total_contestadas,
        SUM(md.segundos_hablados)::int as total_hablado,
        SUM(md.segundos_conectado)::int as total_conectado,
        COALESCE(AVG(md.puntuacion_calidad) FILTER (WHERE md.puntuacion_calidad > 0)::numeric(3,1), 0) as calidad_global
      FROM metricas_diarias md
      JOIN usuarios u ON md.asesor_id = u.id AND u.activo = true
      WHERE md.proyecto_id = $1
        AND md.fecha BETWEEN $2 AND $3
        ${asesorFilter}
    `, params);

    const totalAsig = (global?.total_asignados || 1);
    const totalContact = (global?.total_contactados || 0);
    const totalLlamadas = (global?.total_llamadas || 1);

    const kpis = {
      asignados: global?.total_asignados || 0,
      contactados: totalContact,
      ventas: global?.total_ventas || 0,
      contactabilidad: Math.round((totalContact / totalAsig) * 100),
      efectividad: totalContact > 0 ? Math.round(((global?.total_ventas || 0) / totalContact) * 100) : 0,
      tasa_contestacion: Math.round(((global?.total_contestadas || 0) / totalLlamadas) * 100),
      ocupacion: global?.total_conectado > 0
        ? Math.round(((global?.total_hablado || 0) / global.total_conectado) * 100)
        : 0,
      calidad: parseFloat(global?.calidad_global || '0'),
      asesores_activos: porAsesor.length,
    };

    // ── 6. Ranking (top/bottom) ──
    const ranking = porAsesor.map((a: any, i: number) => ({
      posicion: i + 1,
      id: a.id,
      nombre: a.nombre,
      equipo: a.equipo,
      ventas: a.ventas,
      contactados: a.contactados,
      contactabilidad: a.asignados > 0 ? Math.round((a.contactados / a.asignados) * 100) : 0,
      efectividad: a.contactados > 0 ? Math.round((a.ventas / a.contactados) * 100) : 0,
      tasa_contestacion: a.total_llamadas > 0 ? Math.round((a.llamadas_contestadas / a.total_llamadas) * 100) : 0,
      ocupacion: a.seg_conectado > 0 ? Math.round((a.seg_hablados / a.seg_conectado) * 100) : 0,
      wrap_up: a.wrap_up_promedio,
      hasta_llamar: a.hasta_llamar_promedio,
      calidad: parseFloat(a.calidad_promedio || '0'),
      total_llamadas: a.total_llamadas,
      seg_hablados: a.seg_hablados,
      extension: a.extension_vpbx,
      no_interesa: a.no_interesa,
      no_contesta: a.no_contesta,
    }));

    // ── 7. Tendencias (últimos 7 vs 7 anteriores) ──
    const hoy = new Date();
    const semanaActual = new Date(hoy.getTime() - 7 * 86400000).toISOString().split('T')[0];
    const semanaAnterior = new Date(hoy.getTime() - 14 * 86400000).toISOString().split('T')[0];
    const diaAnteriorSemana = new Date(hoy.getTime() - 7 * 86400000 - 1).toISOString().split('T')[0];

    const { rows: [tendencia] } = await pool.query(`
      SELECT
        (SELECT SUM(ventas)::int FROM metricas_diarias WHERE proyecto_id = $1 AND fecha BETWEEN $2 AND $3) as ventas_actual,
        (SELECT SUM(ventas)::int FROM metricas_diarias WHERE proyecto_id = $1 AND fecha BETWEEN $4 AND $5) as ventas_anterior,
        (SELECT SUM(leads_contactados)::int FROM metricas_diarias WHERE proyecto_id = $1 AND fecha BETWEEN $2 AND $3) as contactados_actual,
        (SELECT SUM(leads_contactados)::int FROM metricas_diarias WHERE proyecto_id = $1 AND fecha BETWEEN $4 AND $5) as contactados_anterior
    `, [proyectoId, semanaActual, hasta, semanaAnterior, diaAnteriorSemana]);

    const delta = (actual: number, anterior: number) => {
      if (!anterior) return actual > 0 ? 100 : 0;
      return Math.round(((actual - anterior) / anterior) * 100);
    };

    const tendencias = {
      ventas: {
        actual: tendencia?.ventas_actual || 0,
        anterior: tendencia?.ventas_anterior || 0,
        delta: delta(tendencia?.ventas_actual || 0, tendencia?.ventas_anterior || 0),
      },
      contactados: {
        actual: tendencia?.contactados_actual || 0,
        anterior: tendencia?.contactados_anterior || 0,
        delta: delta(tendencia?.contactados_actual || 0, tendencia?.contactados_anterior || 0),
      },
    };

    return NextResponse.json({
      kpis,
      tendencias,
      ranking,
      cinturones,
      porHora,
      diarias,
      periodo: { desde, hasta },
    });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
