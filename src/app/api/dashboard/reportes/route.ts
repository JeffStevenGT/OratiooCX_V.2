/**
 * GET /api/dashboard/reportes — Reportes PDF descargables
 * Genera HTML limpio para imprimir como PDF (Ctrl+P) con datos completos.
 * 
 * Query params:
 *   tipo = "completo" | "rendimiento" | "ventas" | "scoring"
 *   desde, hasta = fechas
 *   proyecto_id
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get('tipo') || 'completo';
  const desde = searchParams.get('desde') || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const hasta = searchParams.get('hasta') || new Date().toISOString().split('T')[0];
  const proyectoId = parseInt(searchParams.get('proyecto_id') || '1');

  try {
    const { rows: [proy] } = await pool.query('SELECT nombre_visible FROM proyectos WHERE id = $1', [proyectoId]);
    const proyectoNombre = proy?.nombre_visible || 'Oratioo CX';

    // Scoring distribution
    const { rows: scoring } = await pool.query(
      'SELECT nivel, total, porcentaje FROM v_scoring_resumen WHERE proyecto_id = $1 ORDER BY CASE nivel WHEN \'A+\' THEN 1 WHEN \'A\' THEN 2 WHEN \'B\' THEN 3 WHEN \'C\' THEN 4 WHEN \'D\' THEN 5 WHEN \'E\' THEN 6 END',
      [proyectoId]
    );

    // Ranking agents
    const { rows: ranking } = await pool.query(`
      SELECT u.nombre, u.equipo,
        SUM(md.ventas)::int as ventas,
        SUM(md.leads_contactados)::int as contactados,
        SUM(md.leads_asignados)::int as asignados,
        CASE WHEN SUM(md.leads_asignados) > 0 THEN ROUND((SUM(md.leads_contactados)::numeric / SUM(md.leads_asignados)) * 100, 1) ELSE 0 END as contactabilidad,
        CASE WHEN SUM(md.leads_contactados) > 0 THEN ROUND((SUM(md.ventas)::numeric / SUM(md.leads_contactados)) * 100, 1) ELSE 0 END as efectividad,
        COALESCE(ROUND(AVG(md.puntuacion_calidad) FILTER (WHERE md.puntuacion_calidad > 0)::numeric, 1), 0) as calidad
      FROM metricas_diarias md
      JOIN usuarios u ON md.asesor_id = u.id AND u.rol = 'asesor' AND u.activo = true
      WHERE md.proyecto_id = $1 AND md.fecha BETWEEN $2 AND $3
      GROUP BY u.id, u.nombre, u.equipo
      ORDER BY ventas DESC
    `, [proyectoId, desde, hasta]);

    // Daily metrics
    const { rows: diarias } = await pool.query(`
      SELECT fecha, SUM(ventas)::int as ventas, SUM(leads_contactados)::int as contactados, SUM(leads_asignados)::int as asignados
      FROM metricas_diarias WHERE proyecto_id = $1 AND fecha BETWEEN $2 AND $3
      GROUP BY fecha ORDER BY fecha
    `, [proyectoId, desde, hasta]);

    // KPIs globales
    const { rows: [kpis] } = await pool.query(`
      SELECT SUM(ventas)::int as total_ventas, SUM(leads_contactados)::int as total_contactados, SUM(leads_asignados)::int as total_asignados
      FROM metricas_diarias WHERE proyecto_id = $1 AND fecha BETWEEN $2 AND $3
    `, [proyectoId, desde, hasta]);

    // Forecast
    const { rows: forecast } = await pool.query(
      'SELECT * FROM forecast_ventas($1, 30, 7)', [proyectoId]
    );
    const prediccion = forecast.filter((r: any) => r.tipo === 'forecast');
    const totalForecast = prediccion.reduce((s: number, r: any) => s + (r.ventas || 0), 0);

    // Compras
    const { rows: compras } = await pool.query(`
      SELECT co.fecha_compra, u.nombre as asesor, c.nombre_razon_social as cliente, co.tipo_producto, co.importe
      FROM compras co JOIN usuarios u ON co.asesor_id = u.id JOIN clientes c ON co.id_cliente = c.id_cliente
      WHERE co.proyecto_id = $1 AND co.fecha_compra BETWEEN $2 AND $3
      ORDER BY co.fecha_compra DESC LIMIT 50
    `, [proyectoId, desde, hasta]);

    const fmtTiempo = (seg: number) => {
      if (!seg || seg <= 0) return '—';
      if (seg < 60) return `${seg}s`;
      if (seg < 3600) return `${Math.round(seg / 60)}min`;
      return `${Math.round(seg / 3600)}h`;
    };

    const totalV = kpis?.total_ventas || 0;
    const totalC = kpis?.total_contactados || 0;
    const totalA = Math.max(kpis?.total_asignados || 1, 1);

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte ${proyectoNombre} — ${desde} a ${hasta}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1030; padding: 40px; font-size: 11px; line-height: 1.4; }
  h1 { font-size: 22px; margin-bottom: 4px; color: #481163; }
  h2 { font-size: 14px; color: #0a6ea9; margin: 20px 0 12px; border-bottom: 2px solid #e0e0f0; padding-bottom: 4px; }
  h3 { font-size: 12px; margin: 14px 0 8px; }
  .subtitle { color: #7c757c; font-size: 11px; margin-bottom: 20px; }
  .kpi-grid { display: flex; gap: 12px; margin-bottom: 20px; }
  .kpi { flex: 1; background: #f8f7fa; border-radius: 8px; padding: 12px; text-align: center; }
  .kpi-value { font-size: 24px; font-weight: bold; color: #481163; }
  .kpi-label { font-size: 9px; color: #7c757c; margin-top: 2px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f8f7fa; padding: 6px 8px; text-align: left; font-size: 9px; text-transform: uppercase; color: #7c757c; border-bottom: 1px solid #e0e0f0; }
  td { padding: 5px 8px; border-bottom: 1px solid #f0f0f8; font-size: 10px; }
  .tag { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
  .tag-aplus { background: #d4fceb; color: #05965e; }
  .tag-a { background: #d4fceb; color: #22c55e; }
  .tag-b { background: #e0edff; color: #3b82f6; }
  .tag-c { background: #fff3d6; color: #c27800; }
  .tag-d { background: #ffe0e0; color: #d14343; }
  .tag-e { background: #f0f0f0; color: #888; }
  .chart-bar { display: inline-block; height: 12px; border-radius: 3px; margin-right: 2px; }
  .footer { margin-top: 30px; font-size: 8px; color: #b8b0b8; text-align: center; border-top: 1px solid #e0e0f0; padding-top: 10px; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<h1>📊 ${proyectoNombre}</h1>
<p class="subtitle">Reporte: ${tipo} · ${desde} → ${hasta} · Generado ${new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>

<div class="kpi-grid">
  <div class="kpi"><div class="kpi-value">${totalV}</div><div class="kpi-label">Ventas totales</div></div>
  <div class="kpi"><div class="kpi-value">${totalC}</div><div class="kpi-label">Contactados</div></div>
  <div class="kpi"><div class="kpi-value">${Math.round((totalV / totalA) * 100)}%</div><div class="kpi-label">Tasa conversión</div></div>
  <div class="kpi"><div class="kpi-value">${Math.round((totalC / totalA) * 100)}%</div><div class="kpi-label">Contactabilidad</div></div>
  <div class="kpi"><div class="kpi-value">~${totalForecast}</div><div class="kpi-label">Forecast 7d</div></div>
</div>

${tipo === 'completo' || tipo === 'rendimiento' ? `
<h2>🏆 Ranking de asesores</h2>
<table>
<thead><tr><th>#</th><th>Asesor</th><th>Equipo</th><th>Ventas</th><th>Contactados</th><th>Contactab.</th><th>Efectividad</th><th>Calidad</th></tr></thead>
<tbody>
${ranking.map((a: any, i: number) => `
<tr>
  <td>${i + 1}</td>
  <td><strong>${a.nombre}</strong></td>
  <td>${a.equipo || '—'}</td>
  <td><strong>${a.ventas}</strong></td>
  <td>${a.contactados}</td>
  <td>${a.contactabilidad}%</td>
  <td>${a.efectividad}%</td>
  <td>${a.calidad}</td>
</tr>`).join('')}
</tbody></table>` : ''}

${tipo === 'completo' || tipo === 'scoring' ? `
<h2>🎯 Scoring de leads</h2>
<table>
<thead><tr><th>Nivel</th><th>Total</th><th>%</th><th>Distribución</th></tr></thead>
<tbody>
${scoring.map((s: any) => `
<tr>
  <td><span class="tag tag-${s.nivel.toLowerCase().replace('+','plus')}">${s.nivel}</span></td>
  <td><strong>${s.total}</strong></td>
  <td>${s.porcentaje}%</td>
  <td><span class="chart-bar" style="width:${Math.max(s.porcentaje * 2, 2)}px;background:${s.nivel === 'A+' ? '#05965e' : s.nivel === 'A' ? '#22c55e' : s.nivel === 'B' ? '#3b82f6' : s.nivel === 'C' ? '#f59e0b' : s.nivel === 'D' ? '#ef4444' : '#9ca3af'}"></span></td>
</tr>`).join('')}
</tbody></table>` : ''}

${tipo === 'completo' || tipo === 'ventas' ? `
<h2>📈 Actividad diaria</h2>
<table>
<thead><tr><th>Fecha</th><th>Asignados</th><th>Contactados</th><th>Ventas</th><th>Tasa conv.</th></tr></thead>
<tbody>
${diarias.map((d: any) => `
<tr>
  <td>${new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
  <td>${d.asignados}</td>
  <td>${d.contactados}</td>
  <td><strong>${d.ventas}</strong></td>
  <td>${d.asignados > 0 ? Math.round((d.ventas / d.asignados) * 100) : 0}%</td>
</tr>`).join('')}
</tbody></table>

<h2>🔮 Forecast 7 días</h2>
<table>
<thead><tr><th>Fecha</th><th>Estimado</th><th>Rango</th></tr></thead>
<tbody>
${prediccion.map((p: any) => `
<tr>
  <td>${new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'short' })}</td>
  <td><strong>${p.ventas} ventas</strong></td>
  <td>${p.intervalo_inf} — ${p.intervalo_sup}</td>
</tr>`).join('')}
</tbody></table>
<p style="font-size:10px;color:#7c757c">Total estimado próx. 7 días: <strong>~${totalForecast} ventas</strong> · Media diaria: ${Math.round(totalV / Math.max(diarias.length, 1))}</p>
` : ''}

${compras.length > 0 ? `
<h2>💰 Últimas compras</h2>
<table>
<thead><tr><th>Fecha</th><th>Cliente</th><th>Asesor</th><th>Producto</th><th>Importe</th></tr></thead>
<tbody>
${compras.map((c: any) => `
<tr>
  <td>${new Date(c.fecha_compra + 'T00:00:00').toLocaleDateString('es-PE')}</td>
  <td>${c.cliente || '—'}</td>
  <td>${c.asesor || '—'}</td>
  <td>${c.tipo_producto || '—'}</td>
  <td><strong>${c.importe ? c.importe + ' €' : '—'}</strong></td>
</tr>`).join('')}
</tbody></table>` : ''}

<div class="footer">
  Oratioo CX · Reporte generado automáticamente · ${new Date().toISOString()}
</div>
</body></html>`;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
