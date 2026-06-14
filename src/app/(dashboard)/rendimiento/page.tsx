/**
 * app/(dashboard)/rendimiento/page.tsx — Dashboard de Rendimiento Unificado
 * Fase 7 — Inteligencia Comercial: Métricas de Operadores
 */

'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Phone, Target, Users,
  Download, Loader2, Calendar, Filter, Trophy, Medal, Star,
  Clock, Zap, UserCheck, PhoneCall, Minus, ArrowUp, ArrowDown,
  MessageSquare, Award
} from 'lucide-react';
import Skeleton, { TableSkeleton, PageSkeleton } from '@/components/shared/Skeleton';
import FlipCard from '@/components/shared/FlipCard';

const PAGE_SIZES = [10, 25, 50, 100];

type Rendimiento = {
  kpis: { asignados: number; contactados: number; ventas: number; contactabilidad: number; efectividad: number; tasa_contestacion: number; ocupacion: number; calidad: number; asesores_activos: number };
  tendencias: { ventas: { actual: number; anterior: number; delta: number }; contactados: { actual: number; anterior: number; delta: number } };
  ranking: { posicion: number; id: number; nombre: string; equipo: string; ventas: number; contactados: number; contactabilidad: number; efectividad: number; tasa_contestacion: number; ocupacion: number; wrap_up: number; hasta_llamar: number; calidad: number; total_llamadas: number; seg_hablados: number; no_interesa: number; no_contesta: number }[];
  cinturones: { asesor_id: number; cinturon_nombre: string; cinturon_color: string; cinturon_icono: string; cinturon_orden: number; ventas_mes: number; contactabilidad: string; efectividad: string; calidad: string; prox_cinturon: string; prox_ventas_faltan: number }[];
  porHora: { hora: number; total_llamadas: number; contestadas: number; asesores_activos: number }[];
  diarias: { fecha: string; asignados: number; contactados: number; ventas: number; llamadas: number; contestadas: number; seg_hablados: number; seg_conectado: number }[];
  periodo: { desde: string; hasta: string };
};

const fmtTiempo = (seg: number) => {
  if (!seg || seg <= 0) return '—';
  if (seg < 60) return `${seg}s`;
  if (seg < 3600) return `${Math.round(seg / 60)}min`;
  const h = Math.floor(seg / 3600);
  const m = Math.round((seg % 3600) / 60);
  return `${h}h ${m}min`;
};

const fmtSeg = (seg: number) => {
  if (!seg || seg <= 0) return '—';
  if (seg < 3600) return `${Math.round(seg / 60)}min`;
  return `${Math.round(seg / 3600)}h`;
};

export default function RendimientoPage() {
  const [data, setData] = useState<Rendimiento | null>(null);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0]);
  const [equipo, setEquipo] = useState('');
  const [equipos, setEquipos] = useState<string[]>([]);
  const [vista, setVista] = useState<'ranking' | 'cinturones' | 'tendencias'>('ranking');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ desde, hasta });
      if (equipo) params.set('equipo', equipo);
      const res = await fetch(`/api/dashboard/rendimiento?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) { /* */ }
    setLoading(false);
  };

  useEffect(() => {
    fetch('/api/usuarios?rol=asesor').then(r => r.json()).then(users => {
      setEquipos([...new Set((users || []).map((u: any) => u.equipo).filter(Boolean))] as string[]);
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchData(); setPage(1); }, [desde, hasta, equipo]);
  useEffect(() => { setPage(1); }, [vista]);

  const exportCSV = () => {
    if (!data?.ranking?.length) return;
    const h = 'Pos,Nombre,Equipo,Ventas,Contactados,Contactab.%,Efectiv.%,Tasa Contest.%,Ocupación%,Wrap-up,Hasta llamar,Calidad,No Interesa,No Contesta';
    const rows = data.ranking.map(a =>
      `${a.posicion},${a.nombre},${a.equipo},${a.ventas},${a.contactados},${a.contactabilidad},${a.efectividad},${a.tasa_contestacion},${a.ocupacion},${fmtTiempo(a.wrap_up)},${fmtTiempo(a.hasta_llamar)},${a.calidad},${a.no_interesa},${a.no_contesta}`
    );
    const blob = new Blob([[h, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `rendimiento_${desde}_${hasta}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const Delta = ({ val }: { val: number }) => {
    if (val === 0) return <Minus size={12} className="text-gray-400" />;
    return val > 0
      ? <span className="text-emerald-500 text-[10px] flex items-center gap-0.5"><ArrowUp size={10} />{val}%</span>
      : <span className="text-red-500 text-[10px] flex items-center gap-0.5"><ArrowDown size={10} />{Math.abs(val)}%</span>;
  };

  const cinturonMap = new Map((data?.cinturones || []).map(c => [c.asesor_id, c]));
  const rankingAll = data?.ranking || [];
  const rkTotal = Math.ceil(rankingAll.length / pageSize);
  const rkPaged = rankingAll.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><TrendingUp size={22} className="text-[#0a6ea9]" />Rendimiento</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Métricas unificadas de operadores</p>
        </div>
        <button onClick={exportCSV} disabled={!data}
          className="flex items-center gap-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50 dark:bg-gray-800 disabled:opacity-40">
          <Download size={12} /> Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="card-sm flex items-center gap-3 flex-wrap">
        <Calendar size={14} className="text-gray-500 dark:text-gray-400" />
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-xs" />
        <span className="text-xs text-gray-400 dark:text-gray-500">→</span>
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-xs" />
        <Filter size={14} className="text-gray-500 dark:text-gray-400 ml-2" />
        <select value={equipo} onChange={e => setEquipo(e.target.value)} className="border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-xs bg-white">
          <option value="">Todos los equipos</option>
          {equipos.map(eq => <option key={eq} value={eq}>{eq}</option>)}
        </select>
      </div>

      {loading ? (
        <PageSkeleton />
      ) : !data ? (
        <div className="text-center py-20"><BarChart3 size={48} className="text-gray-400 dark:text-gray-500 mx-auto mb-4" /><p className="text-sm text-gray-500 dark:text-gray-400">Sin datos de rendimiento. Asegúrate de haber generado métricas diarias.</p></div>
      ) : (
        <>
          {/* KPIs principales */}
          <div className="grid grid-cols-5 gap-3">
            <FlipCard back="Total de leads asignados a operadores">
              <KPI icon={Users} label="Asignados" value={data.kpis.asignados} color="text-blue-600" />
            </FlipCard>
            <FlipCard back="Leads contactados exitosamente">
              <KPI icon={PhoneCall} label="Contactados" value={data.kpis.contactados} color="text-emerald-600"
                delta={<Delta val={data.tendencias.contactados.delta} />} />
            </FlipCard>
            <FlipCard back="Total de ventas cerradas">
              <KPI icon={Target} label="Ventas" value={data.kpis.ventas} color="text-[#481163]"
                delta={<Delta val={data.tendencias.ventas.delta} />} />
            </FlipCard>
            <FlipCard back="% de llamadas contestadas">
              <KPI icon={UserCheck} label="Contestación" value={`${data.kpis.tasa_contestacion}%`} color="text-sky-600" />
            </FlipCard>
            <FlipCard back="Tiempo hablado vs conectado">
              <KPI icon={Zap} label="Ocupación" value={`${data.kpis.ocupacion}%`} color="text-amber-600"
                tooltip="Tiempo hablado vs conectado" />
            </FlipCard>
          </div>

          {/* Segunda fila KPIs */}
          <div className="grid grid-cols-6 gap-3">
            <FlipCard back="% ventas sobre contactados">
              <MiniKPI icon={TrendingUp} label="Efectividad" value={`${data.kpis.efectividad}%`} />
            </FlipCard>
            <FlipCard back="% contactados sobre asignados">
              <MiniKPI icon={Target} label="Contactabilidad" value={`${data.kpis.contactabilidad}%`} />
            </FlipCard>
            <FlipCard back="Puntaje promedio de calidad QA">
              <MiniKPI icon={Star} label="Calidad QA" value={data.kpis.calidad.toFixed(1)} />
            </FlipCard>
            <FlipCard back="Asesores con actividad">
              <MiniKPI icon={Users} label="Activos" value={data.kpis.asesores_activos} />
            </FlipCard>
            <FlipCard back="Rango del período analizado">
              <MiniKPI icon={Clock} label="Período" value={`${data.periodo.desde} → ${data.periodo.hasta}`} text />
            </FlipCard>
            <FlipCard back="Variación vs período anterior">
              <MiniKPI icon={MessageSquare} label="Tendencia ventas" value={<Delta val={data.tendencias.ventas.delta} />} raw />
            </FlipCard>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-600">
            {(['ranking', 'cinturones', 'tendencias'] as const).map(v => (
              <button key={v} onClick={() => setVista(v)}
                className={`text-xs px-4 py-2 rounded-t-lg transition-colors font-medium ${
                  vista === v ? 'bg-[#0a6ea9] text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:bg-gray-800'
                }`}>
                {v === 'ranking' && <><Trophy size={12} className="inline mr-1" />Ranking</>}
                {v === 'cinturones' && <><Award size={12} className="inline mr-1" />Cinturones</>}
                {v === 'tendencias' && <><TrendingUp size={12} className="inline mr-1" />Tendencias</>}
              </button>
            ))}
          </div>

          {vista === 'ranking' && (
            <>
              {/* Tabla ranking */}
              <div className="card !p-0 overflow-hidden">
                <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Trophy size={16} className="text-amber-500" /> Ranking de operadores
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                        <th className="table-header px-2 py-2 text-center w-8">#</th>
                        <th className="table-header px-2 py-2 text-left">Asesor</th>
                        <th className="table-header px-2 py-2 text-left">Eq.</th>
                        <th className="table-header px-2 py-2 text-center">🏅</th>
                        <th className="table-header px-2 py-2 text-center">Ventas</th>
                        <th className="table-header px-2 py-2 text-center">Contact.</th>
                        <th className="table-header px-2 py-2 text-center">Cont.%</th>
                        <th className="table-header px-2 py-2 text-center">Efec.%</th>
                        <th className="table-header px-2 py-2 text-center">Contest.%</th>
                        <th className="table-header px-2 py-2 text-center">Ocup.%</th>
                        <th className="table-header px-2 py-2 text-center">Wrap-up</th>
                        <th className="table-header px-2 py-2 text-center">1ª llam.</th>
                        <th className="table-header px-2 py-2 text-center">⭐QA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rkPaged.map((a) => {
                        const cint = cinturonMap.get(a.id);
                        return (
                          <tr key={a.id} className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-800 text-[11px] ${
                            a.posicion === 1 ? 'bg-amber-50/60' : a.posicion === 2 ? 'bg-gray-50' : a.posicion === 3 ? 'bg-orange-50/40' : ''
                          }`}>
                            <td className="py-2 px-2 text-center font-bold">
                              {a.posicion === 1 ? <Trophy size={14} className="text-amber-500 inline" /> :
                               a.posicion === 2 ? <Medal size={14} className="text-gray-400 inline" /> :
                               a.posicion === 3 ? <Medal size={14} className="text-orange-400 inline" /> :
                               a.posicion}
                            </td>
                            <td className="py-2 px-2 font-medium">{a.nombre}</td>
                            <td className="py-2 px-2 text-gray-500 dark:text-gray-400">{a.equipo || '—'}</td>
                            <td className="py-2 px-2 text-center">
                              {cint ? <span title={`${cint.cinturon_nombre} · ${cint.ventas_mes} ventas`}>{cint.cinturon_icono}</span> : '🥋'}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-[#481163]">{a.ventas}</td>
                            <td className="py-2 px-2 text-center">{a.contactados}</td>
                            <td className="py-2 px-2 text-center">
                              <span className={`text-[10px] font-medium ${a.contactabilidad >= 50 ? 'text-emerald-600' : a.contactabilidad >= 30 ? 'text-amber-600' : 'text-red-500'}`}>{a.contactabilidad}%</span>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span className={`text-[10px] font-medium ${a.efectividad >= 25 ? 'text-emerald-600' : a.efectividad >= 15 ? 'text-amber-600' : 'text-red-500'}`}>{a.efectividad}%</span>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span className={`text-[10px] font-medium ${a.tasa_contestacion >= 50 ? 'text-sky-600' : a.tasa_contestacion >= 30 ? 'text-amber-600' : 'text-red-500'}`}>{a.tasa_contestacion}%</span>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <div className="flex items-center gap-1.5 justify-center">
                                <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(a.ocupacion, 100)}%` }} />
                                </div>
                                <span className="text-[10px] w-7 text-right">{a.ocupacion}%</span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center text-gray-500 dark:text-gray-400">{fmtTiempo(a.wrap_up)}</td>
                            <td className="py-2 px-2 text-center text-gray-500 dark:text-gray-400">{fmtTiempo(a.hasta_llamar)}</td>
                            <td className="py-2 px-2 text-center">
                              <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 ${
                                a.calidad >= 7 ? 'bg-emerald-100 text-emerald-700' :
                                a.calidad >= 5 ? 'bg-amber-100 text-amber-700' :
                                a.calidad > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                              }`}>{a.calidad > 0 ? a.calidad.toFixed(1) : '—'}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {rkTotal > 1 && (
                <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Mostrar</span>
                    <select value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1); }}
                      className="border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-xs bg-white">
                      {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <span className="text-xs text-gray-500 dark:text-gray-400">de {rankingAll.length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="btn-outline text-xs px-3 py-1 disabled:opacity-30">Anterior</button>
                    <span className="text-xs text-gray-500 dark:text-gray-400 px-2">{page} / {rkTotal}</span>
                    <button onClick={() => setPage(p => Math.min(rkTotal, p + 1))} disabled={page === rkTotal}
                      className="btn-outline text-xs px-3 py-1 disabled:opacity-30">Siguiente</button>
                  </div>
                </div>
              )}
            </>
          )}

          {vista === 'cinturones' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Cinturones basados en ventas, contactabilidad, efectividad y calidad QA del mes actual.</p>
              <div className="card !p-0 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                      <th className="table-header px-3 py-2 text-left">Asesor</th>
                      <th className="table-header px-3 py-2 text-left">Equipo</th>
                      <th className="table-header px-3 py-2 text-center">Cinturón</th>
                      <th className="table-header px-3 py-2 text-center">Ventas mes</th>
                      <th className="table-header px-3 py-2 text-center">Contactab.</th>
                      <th className="table-header px-3 py-2 text-center">Efectividad</th>
                      <th className="table-header px-3 py-2 text-center">QA</th>
                      <th className="table-header px-3 py-2">Próximo cinturón</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ranking.map((a) => {
                      const cint = cinturonMap.get(a.id);
                      if (!cint) return null;
                      return (
                        <tr key={a.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-800 text-xs">
                          <td className="py-2.5 px-3 font-medium">{a.nombre}</td>
                          <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400">{a.equipo || '—'}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold"
                              style={{ backgroundColor: cint.cinturon_color + '30', color: cint.cinturon_color, border: `1px solid ${cint.cinturon_color}40` }}>
                              {cint.cinturon_icono} {cint.cinturon_nombre}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold">{cint.ventas_mes}</td>
                          <td className="py-2.5 px-3 text-center">{cint.contactabilidad}%</td>
                          <td className="py-2.5 px-3 text-center">{cint.efectividad}%</td>
                          <td className="py-2.5 px-3 text-center">{cint.calidad}</td>
                          <td className="py-2.5 px-3">
                            {cint.prox_cinturon ? (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px]">{cint.prox_cinturon}</span>
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[120px]">
                                  <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full"
                                    style={{ width: `${Math.min(cint.prox_ventas_faltan > 0 ? Math.max(5, 100 - cint.prox_ventas_faltan * 3) : 100, 100)}%` }} />
                                </div>
                                <span className="text-[9px] text-gray-500 dark:text-gray-400 whitespace-nowrap">{cint.prox_ventas_faltan} ventas</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-medium">¡Máximo! ⚫</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {data.cinturones.length === 0 && (
                      <tr><td colSpan={8} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Sin datos de cinturones para este período</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Escala de cinturones */}
              <div className="card">
                <h3 className="text-sm font-semibold mb-3">Escala de cinturones</h3>
                <div className="flex items-center gap-1 overflow-x-auto pb-2">
                  {[
                    { n: 'Blanco', c: '#F5F5F5', v: 0, i: '🥋' },
                    { n: 'Amarillo', c: '#FFD700', v: 5, i: '🟡' },
                    { n: 'Naranja', c: '#FF8C00', v: 10, i: '🟠' },
                    { n: 'Verde', c: '#22C55E', v: 15, i: '🟢' },
                    { n: 'Azul', c: '#3B82F6', v: 20, i: '🔵' },
                    { n: 'Morado', c: '#8B5CF6', v: 30, i: '🟣' },
                    { n: 'Marrón', c: '#92400E', v: 40, i: '🟤' },
                    { n: 'Negro', c: '#1A1030', v: 55, i: '⚫' },
                  ].map(b => (
                    <div key={b.n} className="flex-1 min-w-[80px] text-center p-3 rounded-lg"
                      style={{ backgroundColor: b.c + '20', border: `2px solid ${b.c}40` }}>
                      <span className="text-xl">{b.i}</span>
                      <p className="text-[10px] font-bold mt-1" style={{ color: b.c === '#1A1030' ? '#1A1030' : b.c }}>{b.n}</p>
                      <p className="text-[9px] text-gray-500 dark:text-gray-400">{b.v}+ ventas</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {vista === 'tendencias' && (
            <div className="grid grid-cols-2 gap-6">
              {/* Gráfico diario */}
              <div className="card">
                <h3 className="text-sm font-semibold mb-4">Ventas y contactos por día</h3>
                <div className="space-y-1.5">
                  {data.diarias.map(d => {
                    const maxV = Math.max(1, ...data.diarias.map(x => Math.max(x.ventas, x.contactados)));
                    return (
                      <div key={d.fecha} className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 dark:text-gray-400 w-16 text-right">
                          {new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
                        </span>
                        <div className="flex-1 flex items-center gap-0.5 h-5">
                          <div className="h-full bg-blue-400 rounded-l" style={{ width: `${(d.contactados / maxV) * 100}%`, minWidth: d.contactados > 0 ? '3px' : 0 }} />
                          <div className="h-full bg-[#481163] rounded-r" style={{ width: `${(d.ventas / maxV) * 100}%`, minWidth: d.ventas > 0 ? '3px' : 0 }} />
                        </div>
                        <span className="text-[9px] font-mono w-8 text-right">{d.contactados + d.ventas}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded" /> Contactados</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-[#481163] rounded" /> Ventas</span>
                </div>
              </div>

              {/* Heatmap horario */}
              <div className="card">
                <h3 className="text-sm font-semibold mb-4">Actividad por hora</h3>
                <div className="grid grid-cols-2 gap-2">
                  {data.porHora.map(h => {
                    const maxL = Math.max(1, ...data.porHora.map(x => x.total_llamadas));
                    const intensidad = h.total_llamadas / maxL;
                    return (
                      <div key={h.hora} className="flex items-center gap-2 p-1.5 rounded"
                        style={{ backgroundColor: `rgba(10, 110, 169, ${intensidad * 0.15})` }}>
                        <span className="text-[10px] font-mono w-10">{h.hora}:00</span>
                        <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: `rgba(10, 110, 169, ${intensidad * 0.3})` }}>
                          <div className="h-full bg-[#0a6ea9] rounded-full" style={{ width: `${intensidad * 100}%` }} />
                        </div>
                        <span className="text-[10px] font-bold w-6 text-right">{h.total_llamadas}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tiempo hablado por día */}
              <div className="card">
                <h3 className="text-sm font-semibold mb-4">Tiempo hablado por día</h3>
                <div className="space-y-1.5">
                  {data.diarias.map(d => {
                    const maxS = Math.max(1, ...data.diarias.map(x => x.seg_hablados));
                    return (
                      <div key={d.fecha} className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 dark:text-gray-400 w-16 text-right">
                          {new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
                        </span>
                        <div className="flex-1 h-4 bg-gray-50 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-sky-400 to-emerald-500 rounded-full"
                            style={{ width: `${(d.seg_hablados / maxS) * 100}%`, minWidth: d.seg_hablados > 0 ? '3px' : 0 }} />
                        </div>
                        <span className="text-[9px] font-mono w-12 text-right">{fmtSeg(d.seg_hablados)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Resumen rápida semanal */}
              <div className="card">
                <h3 className="text-sm font-semibold mb-4">Comparativa semanal</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Ventas esta semana</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{data.tendencias.ventas.actual}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Semana anterior</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{data.tendencias.ventas.anterior}</p>
                    </div>
                    <div className={`text-sm font-bold ${data.tendencias.ventas.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {data.tendencias.ventas.delta >= 0 ? '+' : ''}{data.tendencias.ventas.delta}%
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Contactados esta semana</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{data.tendencias.contactados.actual}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Semana anterior</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{data.tendencias.contactados.anterior}</p>
                    </div>
                    <div className={`text-sm font-bold ${data.tendencias.contactados.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {data.tendencias.contactados.delta >= 0 ? '+' : ''}{data.tendencias.contactados.delta}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {/* ── Info ── */}
      <div className="mt-8 card-sm bg-gray-50 dark:bg-gray-800 dark:bg-[#1e1a2a] border-dashed border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a]">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">💡 ¿Cómo funciona?</h3>
        <ul className="space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
          <li>· Métricas detalladas de operadores: contactabilidad, conversión, ocupación, calidad. Ranking y tendencias.</li>
        </ul>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, color, delta, tooltip }: any) {
  return (
    <div className="card text-center py-3 relative" title={tooltip}>
      <Icon size={20} className={`mx-auto mb-1 ${color}`} />
      <div className="flex items-center justify-center gap-1">
        <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
        {delta}
      </div>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function MiniKPI({ icon: Icon, label, value, text, raw }: any) {
  return (
    <div className="card text-center py-2.5">
      {Icon && <Icon size={14} className="mx-auto mb-0.5 text-gray-500 dark:text-gray-400" />}
      {text ? (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">{value}</p>
      ) : raw ? (
        <div className="flex justify-center">{value}</div>
      ) : (
        <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
      )}
      <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
