/**
 * app/(dashboard)/inteligencia/page.tsx — Inteligencia Comercial
 * ==============================================================
 * Scoring de leads, Forecast, Métricas de operadores, Salud de datos.
 * V2: Lazy loading — cada tab carga sus datos solo al clickearse.
 */

'use client';

import { useState, useCallback } from 'react';
import {
  BrainCircuit, TrendingUp, BarChart3, Activity, Shield, AlertTriangle,
  Loader2, RefreshCw, Star, StarOff, Target, Calendar,
  Users, Layers, Zap, Clock, Eye,
} from 'lucide-react';
import Skeleton from '@/components/shared/Skeleton';
import FlipCard from '@/components/shared/FlipCard';
import { useAPI, apiUrl } from '@/hooks/useSWR';

const PAGE_SIZES = [10, 25, 50, 100];

type ScoringData = {
  kpis: { total_evaluados: number; top_leads: number; calientes: number; frios: number; puntuacion_media: number };
  distribucion: { nivel: string; count: number }[];
  leads: { id_cliente: string; nombre_razon_social: string; nivel: string; puntuacion: number; updated_at: string }[];
};

type ForecastData = {
  historico: { fecha: string; ventas: number }[];
  prediccion: { fecha: string; ventas: number }[];
  resumen: { media_diaria: number; total_forecast: number; dias_forecast: number };
};

type SaludData = {
  abandono: { motivo: string; total: number }[];
  total_abandonados: number;
  reutilizacion: { total_registros: number; reanalizados: number; tasa: number; promedio_dias_entre_extracciones: number };
  scoring_contacto: { nivel_contacto: string; total: number }[];
};

const NIVEL_COLORS: Record<string, string> = {
  'A+': 'bg-red-100 text-red-700 border-red-200',
  'A': 'bg-orange-100 text-orange-700 border-orange-200',
  'B': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'C': 'bg-green-100 text-green-700 border-green-200',
  'D': 'bg-slate-100 text-slate-600 border-slate-200',
  'E': 'bg-gray-100 text-gray-500 border-gray-200',
};

const NIVEL_EMOJI: Record<string, string> = {
  'A+': '\uD83D\uDC51', 'A': '\uD83D\uDFE0', 'B': '\uD83D\uDFE1', 'C': '\uD83D\uDFE2', 'D': '\u26AA', 'E': '\u26AB',
};

export default function InteligenciaPage() {
  const [tab, setTab] = useState<'scoring' | 'forecast' | 'metricas' | 'salud'>('scoring');
  // Track which tabs have been visited (so we don't re-fetch on every toggle)
  const [visited, setVisited] = useState<Set<string>>(new Set(['scoring']));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [forecastDias, setForecastDias] = useState(7);

  const selectTab = (t: typeof tab) => {
    setTab(t);
    setPage(1);
    setVisited(prev => new Set(prev).add(t));
  };

  // Only fetch when tab is visited (lazy)
  const scoringUrl = visited.has('scoring') ? apiUrl('/api/dashboard/scoring') : null;
  const forecastUrl = visited.has('forecast') ? apiUrl('/api/dashboard/forecast', { dias: '30', forecast: String(forecastDias) }) : null;
  const rendimientoUrl = visited.has('metricas') ? apiUrl('/api/dashboard/rendimiento', { dias: '30' }) : null;
  const saludUrl = visited.has('salud') ? apiUrl('/api/dashboard/salud-base', { dias: '90' }) : null;

  const { data: scoring, isLoading: scoringLoading, mutate: mutateScoring } = useAPI<ScoringData>(scoringUrl);
  const { data: forecast, isLoading: forecastLoading } = useAPI<ForecastData>(forecastUrl);
  const { data: metricas, isLoading: metricasLoading } = useAPI<any>(rendimientoUrl);
  const { data: salud, isLoading: saludLoading } = useAPI<SaludData>(saludUrl);

  const recalcularScoring = async () => {
    try {
      await fetch('/api/dashboard/scoring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proyecto_id: 1 }) });
      mutateScoring();
    } catch { /* */ }
  };

  const PaginationUI = ({ total, count }: { total: number; count: number }) => total > 1 ? (
    <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">Mostrar</span>
        <select value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1); }}
          className="border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-xs bg-white">
          {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-gray-500 dark:text-gray-400">de {count}</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
          className="btn-outline text-xs px-3 py-1 disabled:opacity-30">Anterior</button>
        <span className="text-xs text-gray-500 dark:text-gray-400 px-2">{page} / {total}</span>
        <button onClick={() => setPage(p => Math.min(total, p + 1))} disabled={page === total}
          className="btn-outline text-xs px-3 py-1 disabled:opacity-30">Siguiente</button>
      </div>
    </div>
  ) : null;

  const tabs = [
    { key: 'scoring' as const, label: 'Scoring', icon: Star },
    { key: 'forecast' as const, label: 'Forecast', icon: TrendingUp },
    { key: 'metricas' as const, label: 'Métricas', icon: Activity },
    { key: 'salud' as const, label: 'Salud Datos', icon: Shield },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><BrainCircuit size={22} className="text-[#0a6ea9]" />Inteligencia Comercial</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Scoring, forecast, métricas y salud de datos</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-600">
        {tabs.map(t => (
          <button key={t.key} onClick={() => selectTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-[#0a6ea9] text-[#0a6ea9]' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white'
            }`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── SCORING ── */}
      {tab === 'scoring' && (
        <div className="space-y-5 animate-fade-in" key="scoring">
          {scoringLoading ? (
            <Skeleton variant="kpi" count={5} className="mb-5" />
          ) : scoring ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <FlipCard back="Total de leads evaluados por el scoring">
                  <KpiCard label="Evaluados" value={scoring.kpis.total_evaluados} icon={Layers} color="slate" />
                </FlipCard>
                <FlipCard back="Leads A+/A. Máxima prioridad">
                  <KpiCard label="Top Leads (A+/A)" value={scoring.kpis.top_leads} icon={Star} color="red" />
                </FlipCard>
                <FlipCard back="Leads A+ a B. Buen potencial">
                  <KpiCard label="Calientes (A+→B)" value={scoring.kpis.calientes} icon={Zap} color="orange" />
                </FlipCard>
                <FlipCard back="Leads D/E. Bajo potencial">
                  <KpiCard label="Fríos (D/E)" value={scoring.kpis.frios} icon={StarOff} color="gray" />
                </FlipCard>
                <FlipCard back="Promedio 1-100 de todos los leads">
                  <KpiCard label="Punt. Media" value={Number(scoring.kpis.puntuacion_media)?.toFixed(1) || '0'} icon={Target} color="blue" suffix="/100" />
                </FlipCard>
              </div>

              {/* Distribución */}
              <div className="card-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Distribución por Nivel</h3>
                {scoring.distribucion?.length > 0 ? (
                  <div className="flex items-end gap-2 h-32">
                    {scoring.distribucion.map((d: any) => {
                      const max = Math.max(...scoring.distribucion.map((x: any) => x.count || 0), 1);
                      const pct = ((d.count || 0) / max) * 100;
                      return (
                        <div key={d.nivel} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs font-bold text-gray-900 dark:text-white">{d.count}</span>
                          <div className="w-full rounded-t-md transition-all" style={{
                            height: `${Math.max(pct, 4)}%`,
                            backgroundColor: d.nivel === 'A+' ? '#ef4444' : d.nivel === 'A' ? '#f97316' : d.nivel === 'B' ? '#eab308' : d.nivel === 'C' ? '#22c55e' : d.nivel === 'D' ? '#94a3b8' : '#6b7280',
                          }} />
                          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{NIVEL_EMOJI[d.nivel]} {d.nivel}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">Sin datos. Ejecutá "Recalcular Scoring".</p>
                )}
              </div>

              {/* Lista de leads */}
              <div className="card-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Leads por Nivel</h3>
                  <button onClick={recalcularScoring}
                    className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5">
                    <RefreshCw size={11} /> Recalcular
                  </button>
                </div>
                {scoring.leads?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Cliente</th>
                          <th className="px-3 py-2 text-center text-gray-500 dark:text-gray-400 font-medium">Nivel</th>
                          <th className="px-3 py-2 text-center text-gray-500 dark:text-gray-400 font-medium">Puntuación</th>
                          <th className="px-3 py-2 text-right text-gray-500 dark:text-gray-400 font-medium">Actualizado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const leadsAll = scoring.leads || [];
                          const lpTotal = Math.ceil(leadsAll.length / pageSize);
                          const lpPaged = leadsAll.slice((page - 1) * pageSize, page * pageSize);
                          return (
                            <>
                            {lpPaged.map((l: any) => (
                              <tr key={l.id_cliente} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-800">
                                <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{l.nombre_razon_social || l.id_cliente}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${NIVEL_COLORS[l.nivel] || 'bg-gray-100 text-gray-600'}`}>
                                    {NIVEL_EMOJI[l.nivel]} {l.nivel}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center font-mono">{l.puntuacion}</td>
                                <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">{l.updated_at ? new Date(l.updated_at).toLocaleDateString('es-PE') : '—'}</td>
                              </tr>
                            ))}
                            {lpTotal > 1 && (
                              <tr><td colSpan={4} className="p-0"><PaginationUI total={lpTotal} count={leadsAll.length} /></td></tr>
                            )}
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 py-8 text-center">No hay leads evaluados. Ejecutá "Recalcular Scoring".</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">Error al cargar scoring.</p>
          )}
        </div>
      )}

      {/* ── FORECAST ── */}
      {tab === 'forecast' && (
        <div className="space-y-5 animate-fade-in" key="forecast">
          {forecastLoading ? (
            <Skeleton variant="kpi" count={3} />
          ) : forecast ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <FlipCard back="Promedio de ventas por día">
                  <KpiCard label="Media Diaria" value={forecast.resumen.media_diaria} icon={Activity} color="blue" suffix=" ventas" />
                </FlipCard>
                <FlipCard back="Proyección de ventas del modelo">
                  <KpiCard label="Forecast Total" value={forecast.resumen.total_forecast} icon={TrendingUp} color="emerald" suffix={` en ${forecast.resumen.dias_forecast}d`} />
                </FlipCard>
                <FlipCard back="Período de proyección">
                  <KpiCard label="Días Forecast" value={forecast.resumen.dias_forecast} icon={Calendar} color="purple" />
                </FlipCard>
              </div>

              <div className="card-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Histórico + Predicción</h3>
                  <select value={forecastDias} onChange={e => setForecastDias(Number(e.target.value))}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-xs">
                    <option value={3}>3 días</option>
                    <option value={7}>7 días</option>
                    <option value={14}>14 días</option>
                    <option value={30}>30 días</option>
                  </select>
                </div>

                {[...(forecast.historico || []), ...(forecast.prediccion || [])].length > 0 ? (
                  <div className="flex items-end gap-1 h-40">
                    {forecast.historico?.map((d: any, i: number) => {
                      const all = [...(forecast.historico || []), ...(forecast.prediccion || [])];
                      const maxV = Math.max(...all.map((x: any) => x.ventas || 0), 1);
                      const pct = ((d.ventas || 0) / maxV) * 100;
                      return (
                        <div key={`h-${i}`} className="flex-1 flex flex-col items-center gap-0.5 min-w-[20px]">
                          <span className="text-[9px] font-medium text-gray-900 dark:text-white">{d.ventas}</span>
                          <div className="w-full rounded-t-sm bg-[#0a6ea9]" style={{ height: `${Math.max(pct, 3)}%`, opacity: 1 }} />
                          <span className="text-[8px] text-gray-500 dark:text-gray-400">{d.fecha?.slice(5)}</span>
                        </div>
                      );
                    })}
                    {forecast.prediccion?.map((d: any, i: number) => {
                      const all = [...(forecast.historico || []), ...(forecast.prediccion || [])];
                      const maxV = Math.max(...all.map((x: any) => x.ventas || 0), 1);
                      const pct = ((d.ventas || 0) / maxV) * 100;
                      return (
                        <div key={`p-${i}`} className="flex-1 flex flex-col items-center gap-0.5 min-w-[20px]">
                          <span className="text-[9px] font-medium text-emerald-600">{d.ventas}</span>
                          <div className="w-full rounded-t-sm bg-emerald-400 border border-dashed border-emerald-500"
                            style={{ height: `${Math.max(pct, 3)}%`, opacity: 0.7 }} />
                          <span className="text-[8px] text-emerald-600">{d.fecha?.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 py-8 text-center">Sin datos para mostrar.</p>
                )}

                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                  <span className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                    <span className="w-3 h-3 rounded-sm bg-[#0a6ea9]" /> Histórico
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                    <span className="w-3 h-3 rounded-sm bg-emerald-400 border border-dashed border-emerald-500" /> Forecast
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">Error al cargar forecast.</p>
          )}
        </div>
      )}

      {/* ── MÉTRICAS ── */}
      {tab === 'metricas' && (
        <div className="space-y-5 animate-fade-in" key="metricas">
          {metricasLoading ? (
            <Skeleton variant="table" rows={6} cols={5} />
          ) : metricas ? (
            <>
              {/* Usamos el ranking de rendimiento como tabla de métricas */}
              <div className="card-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Ranking de operadores</h3>
                {metricas.ranking?.length > 0 ? (() => {
                  const rAll = metricas.ranking || [];
                  const rtTotal = Math.ceil(rAll.length / pageSize);
                  const rtPaged = rAll.slice((page - 1) * pageSize, page * pageSize);
                  return (<>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-3 py-2 text-left">Asesor</th>
                          <th className="px-3 py-2 text-center">Ventas</th>
                          <th className="px-3 py-2 text-center">Contact.</th>
                          <th className="px-3 py-2 text-center">Contactab.</th>
                          <th className="px-3 py-2 text-center">Efectiv.</th>
                          <th className="px-3 py-2 text-center">Tasa Cont.</th>
                          <th className="px-3 py-2 text-center">Ocupac.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rtPaged.map((a: any) => (
                          <tr key={a.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-800">
                            <td className="px-3 py-2 font-medium">{a.nombre}</td>
                            <td className="px-3 py-2 text-center font-bold text-[#481163]">{a.ventas}</td>
                            <td className="px-3 py-2 text-center">{a.contactados}</td>
                            <td className="px-3 py-2 text-center">{a.contactabilidad}%</td>
                            <td className="px-3 py-2 text-center">{a.efectividad}%</td>
                            <td className="px-3 py-2 text-center">{a.tasa_contestacion}%</td>
                            <td className="px-3 py-2 text-center">{a.ocupacion}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rtTotal > 1 && <PaginationUI total={rtTotal} count={rAll.length} />}
                  </>);
                })() : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 py-8 text-center">Sin datos de métricas.</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">Error al cargar métricas.</p>
          )}
        </div>
      )}

      {/* ── SALUD DE DATOS ── */}
      {tab === 'salud' && (
        <div className="space-y-5 animate-fade-in" key="salud">
          {saludLoading ? (
            <Skeleton variant="kpi" count={4} />
          ) : salud ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <FlipCard back="Leads abandonados por diversas causas">
                  <KpiCard label="Total Abandonados" value={salud.total_abandonados || 0} icon={AlertTriangle} color="red" suffix=" leads" />
                </FlipCard>
                <FlipCard back="Registros reanalizados por el sistema">
                  <KpiCard label="Reanalizados" value={salud.reutilizacion?.reanalizados || 0} icon={RefreshCw} color="blue" />
                </FlipCard>
                <FlipCard back="Porcentaje de reutilización de datos">
                  <KpiCard label="Tasa Reutilización" value={salud.reutilizacion?.tasa || 0} icon={Activity} color="purple" suffix="%" />
                </FlipCard>
                <FlipCard back="Promedio de días entre extracciones">
                  <KpiCard label="Días Entre Extr." value={salud.reutilizacion?.promedio_dias_entre_extracciones || 0} icon={Clock} color="slate" suffix="d" />
                </FlipCard>
              </div>

              {/* Abandono */}
              <div className="card-sm">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Abandono de Leads</h3>
                {salud.abandono?.length > 0 ? (
                  <div className="space-y-2">
                    {salud.abandono.map((a: any, i: number) => {
                      const max = Math.max(...salud.abandono.map((x: any) => x.total || 0), 1);
                      const pct = ((a.total || 0) / max) * 100;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-32 text-right">{a.motivo}</span>
                          <div className="flex-1 bg-[#f0f0f8] rounded-full h-5 overflow-hidden">
                            <div className="h-full bg-red-400 rounded-full flex items-center justify-end pr-2 transition-all"
                              style={{ width: `${pct}%` }}>
                              <span className="text-[10px] font-bold text-white">{a.total}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">Sin datos de abandono.</p>
                )}
              </div>

              {/* Scoring Contactabilidad */}
              {salud.scoring_contacto?.length > 0 && (
                <div className="card-sm">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Scoring de Contactabilidad</h3>
                  <div className="flex items-end gap-2 h-24">
                    {salud.scoring_contacto.map((d: any) => {
                      const max = Math.max(...salud.scoring_contacto.map((x: any) => x.total || 0), 1);
                      const pct = ((d.total || 0) / max) * 100;
                      return (
                        <div key={d.nivel_contacto} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs font-bold text-gray-900 dark:text-white">{d.total}</span>
                          <div className="w-full rounded-t-md bg-[#0a6ea9]" style={{ height: `${Math.max(pct, 4)}%`, opacity: 0.7 }} />
                          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{d.nivel_contacto}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">Error al cargar salud de datos.</p>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color, suffix = '' }: any) {
  return (
    <div className="card text-center py-3">
      <Icon size={20} className={`mx-auto mb-1 ${color === 'red' ? 'text-red-500' : color === 'orange' ? 'text-orange-500' : color === 'emerald' ? 'text-emerald-600' : color === 'blue' ? 'text-blue-600' : color === 'purple' ? 'text-purple-600' : color === 'slate' ? 'text-slate-600' : 'text-gray-500'}`} />
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}{suffix}</p>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
