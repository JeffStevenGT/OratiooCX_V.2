/**
 * app/(dashboard)/rendimiento/page.tsx — Rendimiento (v4 UX)
 * Tabla compacta: 6 columnas. Drawer al click. Time tabs. Secciones colapsables.
 * Vista por rol: asesor ve solo su posición, supervisor/jefe ve ranking completo.
 */

'use client';

import { useState } from 'react';
import {
  BarChart3, TrendingUp, Target, Users, Download, Trophy, Medal, Star,
  Clock, Zap, PhoneCall, Minus, ArrowUp, ArrowDown, Award, X
} from 'lucide-react';
import { PageSkeleton } from '@/components/shared/Skeleton';
import FlipCard from '@/components/shared/FlipCard';
import CollapsibleSection from '@/components/shared/CollapsibleSection';
import TimeTabs, { timePresetToRange } from '@/components/shared/TimeTabs';
import { useAPI, apiUrl } from '@/hooks/useSWR';
import { useEquipos } from '@/hooks/useEquipos';
import { useSession } from '@/hooks/useSession';

const PAGE_SIZES = [10, 25, 50, 100];

type Rendimiento = {
  kpis: { asignados: number; contactados: number; ventas: number; contactabilidad: number; efectividad: number; tasa_contestacion: number; ocupacion: number; calidad: number; asesores_activos: number };
  tendencias: { ventas: { actual: number; anterior: number; delta: number }; contactados: { actual: number; anterior: number; delta: number } };
  ranking: { posicion: number; id: number; nombre: string; equipo: string; ventas: number; contactados: number; contactabilidad: number; efectividad: number; tasa_contestacion: number; ocupacion: number; wrap_up: number; hasta_llamar: number; calidad: number; total_llamadas: number; seg_hablados: number; no_interesa: number; no_contesta: number }[];
  cinturones: { asesor_id: number; cinturon_nombre: string; cinturon_color: string; cinturon_icono: string; cinturon_orden: number; ventas_mes: number; contactabilidad: string; efectividad: string; calidad: string; prox_cinturon: string; prox_ventas_faltan: number }[];
  porHora: { hora: number; total_llamadas: number; contestadas: number; asesores_activos: number }[];
  diarias: { fecha: string; asignados: number; contactados: number; ventas: number; llamadas: number; contestadas: number; seg_hablados: number; seg_conectado: number }[];
  periodo: { desde: string; hasta: string };
  pagination: { page: number; limit: number; total: number; totalPages: number } | null;
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
  const { role } = useSession();
  const isAsesor = role === 'asesor';
  const [timePreset, setTimePreset] = useState('mes');
  const { desde, hasta } = timePresetToRange(timePreset);
  const [equipo, setEquipo] = useState('');
  const [vista, setVista] = useState<'ranking' | 'cinturones' | 'tendencias'>('ranking');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<number | null>(null); // drawer

  const { equipos } = useEquipos();

  const url = apiUrl('/api/dashboard/rendimiento', {
    desde, hasta, equipo,
    page: String(page), limit: String(pageSize),
  });
  const { data, isLoading } = useAPI<Rendimiento>(url);
  const { data: allData } = useAPI<Rendimiento>(apiUrl('/api/dashboard/rendimiento', { desde, hasta, equipo }));

  const exportCSV = () => {
    const ranking = allData?.ranking || [];
    if (!ranking.length) return;
    const h = 'Pos,Nombre,Equipo,Ventas,Contactados,Contactab.%,Efectiv.%,Tasa Contest.%,Ocupacion%,Wrap-up,Hasta llamar,Calidad,No Interesa,No Contesta';
    const rows = ranking.map(a => `${a.posicion},${a.nombre},${a.equipo},${a.ventas},${a.contactados},${a.contactabilidad},${a.efectividad},${a.tasa_contestacion},${a.ocupacion},${fmtTiempo(a.wrap_up)},${fmtTiempo(a.hasta_llamar)},${a.calidad},${a.no_interesa},${a.no_contesta}`);
    const blob = new Blob([[h, ...rows].join('\n')], { type: 'text/csv' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = u; a.download = `rendimiento_${desde}_${hasta}.csv`; a.click();
    URL.revokeObjectURL(u);
  };

  const Delta = ({ val }: { val: number }) => {
    if (val === 0) return <Minus size={12} className="text-gray-400" />;
    return val > 0
      ? <span className="text-emerald-500 text-[10px] flex items-center gap-0.5"><ArrowUp size={10} />{val}%</span>
      : <span className="text-red-500 text-[10px] flex items-center gap-0.5"><ArrowDown size={10} />{Math.abs(val)}%</span>;
  };

  const pagination = data?.pagination || null;
  const totalPages = pagination?.totalPages || 1;

  // Find selected row for drawer
  const selectedRow = selected ? (data?.ranking || []).find(r => r.id === selected) : null;
  const cinturonMap = new Map((allData?.cinturones || []).map(c => [c.asesor_id, c]));

  return (
    <div className="space-y-4 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><TrendingUp size={22} className="text-[#0a6ea9]" />Rendimiento</h1>
        </div>
        <div className="flex items-center gap-3">
          <TimeTabs value={timePreset} onChange={v => { setTimePreset(v); setPage(1); }} />
          <button onClick={exportCSV} disabled={!data}
            className="flex items-center gap-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50 dark:bg-gray-800 disabled:opacity-40">
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {isLoading ? <PageSkeleton /> : !data ? (
        <div className="text-center py-20"><BarChart3 size={48} className="text-gray-400 dark:text-gray-500 mx-auto mb-4" /><p className="text-sm text-gray-500 dark:text-gray-400">Sin datos</p></div>
      ) : (
        <>
          {/* KPIs — solo 4 visibles */}
          <div className="grid grid-cols-4 gap-3">
            <FlipCard back="Leads contactados exitosamente">
              <KPI icon={PhoneCall} label="Contactados" value={data.kpis.contactados} color="text-emerald-600" delta={<Delta val={data.tendencias.contactados.delta} />} />
            </FlipCard>
            <FlipCard back="Total de ventas cerradas">
              <KPI icon={Target} label="Ventas" value={data.kpis.ventas} color="text-[#481163]" delta={<Delta val={data.tendencias.ventas.delta} />} />
            </FlipCard>
            <FlipCard back="% ventas sobre contactados">
              <KPI icon={TrendingUp} label="Efectividad" value={`${data.kpis.efectividad}%`} color="text-amber-600" />
            </FlipCard>
            <FlipCard back="Calidad QA + asesores activos">
              <KPI icon={Zap} label="Calidad / Activos" value={`${data.kpis.calidad.toFixed(1)} · ${data.kpis.asesores_activos}`} color="text-sky-600" />
            </FlipCard>
          </div>

          {/* Filtro equipo */}
          {equipos.length > 1 && (
            <select value={equipo} onChange={e => { setEquipo(e.target.value); setPage(1); }}
              className="border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-xs bg-white w-fit">
              <option value="">Todos los equipos</option>
              {equipos.map(eq => <option key={eq} value={eq}>{eq}</option>)}
            </select>
          )}

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

          {/* RANKING: tabla compacta 6 cols + drawer */}
          {vista === 'ranking' && (
            <div className="card !p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Trophy size={16} className="text-amber-500" /> Ranking
                  <span className="text-[10px] text-gray-400 font-normal">({pagination?.total || 0} asesores)</span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                      <th className="px-2 py-2 text-center w-8 text-[10px] text-gray-500">#</th>
                      <th className="px-2 py-2 text-left text-[10px] text-gray-500">Asesor</th>
                      <th className="px-2 py-2 text-center text-[10px] text-gray-500">Ventas</th>
                      <th className="px-2 py-2 text-center text-[10px] text-gray-500">Contact.</th>
                      <th className="px-2 py-2 text-center text-[10px] text-gray-500">Efec.</th>
                      <th className="px-2 py-2 text-center text-[10px] text-gray-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.ranking || []).map((a) => {
                      const cint = cinturonMap.get(a.id);
                      const pctMeta = (a as any).porcentaje_meta || 0;
                      return (
                        <tr key={a.id}
                          onClick={() => setSelected(selected === a.id ? null : a.id)}
                          className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-[11px] cursor-pointer transition-colors ${
                            selected === a.id ? 'bg-[#0a6ea9]/5' : ''
                          } ${a.posicion === 1 ? 'bg-amber-50/60' : a.posicion === 2 ? 'bg-gray-50' : a.posicion === 3 ? 'bg-orange-50/40' : ''}`}>
                          <td className="py-2 px-2 text-center font-bold">
                            {a.posicion === 1 ? <Trophy size={14} className="text-amber-500 inline" /> :
                             a.posicion === 2 ? <Medal size={14} className="text-gray-400 inline" /> :
                             a.posicion === 3 ? <Medal size={14} className="text-orange-400 inline" /> : a.posicion}
                          </td>
                          <td className="py-2 px-2 font-medium flex items-center gap-1.5">
                            {a.nombre}
                            {cint && <span title={cint.cinturon_nombre} className="text-xs">{cint.cinturon_icono}</span>}
                          </td>
                          <td className="py-2 px-2 text-center font-bold text-[#481163]">{a.ventas}</td>
                          <td className="py-2 px-2 text-center">{a.contactados}</td>
                          <td className="py-2 px-2 text-center">
                            <span className={`text-[10px] font-medium ${a.efectividad >= 25 ? 'text-emerald-600' : a.efectividad >= 15 ? 'text-amber-600' : 'text-red-500'}`}>{a.efectividad}%</span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                              pctMeta >= 100 ? 'bg-emerald-100 text-emerald-700' :
                              pctMeta >= 75 ? 'bg-amber-100 text-amber-700' :
                              pctMeta > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                            }`}>{pctMeta > 0 ? `${pctMeta}%` : '—'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Drawer: full details of selected row */}
                {selectedRow && (
                  <div className="border-t-2 border-[#0a6ea9] bg-[#0a6ea9]/[0.02] px-5 py-4 animate-fade-in">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">{selectedRow.nombre} <span className="text-[10px] text-gray-400 font-normal">#{selectedRow.posicion} · {selectedRow.equipo}</span></h4>
                      <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
                      <DetailBadge label="Ventas" value={selectedRow.ventas} color="text-[#481163]" />
                      <DetailBadge label="Contactados" value={selectedRow.contactados} />
                      <DetailBadge label="Contactab." value={`${selectedRow.contactabilidad}%`} />
                      <DetailBadge label="Efectividad" value={`${selectedRow.efectividad}%`} />
                      <DetailBadge label="Tasa Cont." value={`${selectedRow.tasa_contestacion}%`} />
                      <DetailBadge label="Ocupación" value={`${selectedRow.ocupacion}%`} />
                      <DetailBadge label="Wrap-up" value={fmtTiempo(selectedRow.wrap_up)} />
                      <DetailBadge label="1ª Llamada" value={fmtTiempo(selectedRow.hasta_llamar)} />
                      <DetailBadge label="Calidad QA" value={selectedRow.calidad > 0 ? selectedRow.calidad.toFixed(1) : '—'} />
                      <DetailBadge label="No Interesa" value={selectedRow.no_interesa} color="text-red-500" />
                      <DetailBadge label="No Contesta" value={selectedRow.no_contesta} color="text-amber-500" />
                      <DetailBadge label="Llamadas" value={selectedRow.total_llamadas} />
                    </div>
                    {(() => {
                      const cint = cinturonMap.get(selectedRow.id);
                      if (!cint) return null;
                      return (
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ backgroundColor: cint.cinturon_color + '30', color: cint.cinturon_color }}>
                            {cint.cinturon_icono} {cint.cinturon_nombre}
                          </span>
                          <span>{cint.ventas_mes} ventas mes</span>
                          {cint.prox_cinturon && <span>→ {cint.prox_cinturon} (faltan {cint.prox_ventas_faltan})</span>}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                    <select value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1); }}
                      className="border border-gray-200 rounded px-2 py-1 text-[10px]">
                      {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="text-[10px] px-2 py-1 border rounded disabled:opacity-30">Anterior</button>
                      <span className="text-[10px] text-gray-500 px-2">{page}/{totalPages}</span>
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="text-[10px] px-2 py-1 border rounded disabled:opacity-30">Siguiente</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CINTURONES: colapsable */}
          {vista === 'cinturones' && allData && (
            <CollapsibleSection title="Cinturones del equipo" defaultOpen
              icon={<Award size={14} className="text-amber-500" />}
              badge={`${allData.cinturones.length} asesores`}>
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                      <th className="px-2 py-1.5 text-left text-[10px] text-gray-500">Asesor</th>
                      <th className="px-2 py-1.5 text-center text-[10px] text-gray-500">Cinturón</th>
                      <th className="px-2 py-1.5 text-center text-[10px] text-gray-500">Ventas</th>
                      <th className="px-2 py-1.5 text-center text-[10px] text-gray-500">Contactab.</th>
                      <th className="px-2 py-1.5 text-center text-[10px] text-gray-500">Efectiv.</th>
                      <th className="px-2 py-1.5 text-left text-[10px] text-gray-500">Próximo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allData.cinturones.map((cint) => {
                      const a = allData.ranking.find(r => r.id === cint.asesor_id);
                      return (
                        <tr key={cint.asesor_id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-800 text-[11px]">
                          <td className="py-1.5 px-2 font-medium">{a?.nombre || '—'}</td>
                          <td className="py-1.5 px-2 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ backgroundColor: cint.cinturon_color + '30', color: cint.cinturon_color }}>
                              {cint.cinturon_icono} {cint.cinturon_nombre}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-center font-bold">{cint.ventas_mes}</td>
                          <td className="py-1.5 px-2 text-center">{cint.contactabilidad}%</td>
                          <td className="py-1.5 px-2 text-center">{cint.efectividad}%</td>
                          <td className="py-1.5 px-2 text-[10px]">{cint.prox_cinturon ? `${cint.prox_cinturon} (${cint.prox_ventas_faltan})` : '¡Máximo! ⚫'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Escala */}
              <div className="flex items-center gap-1 overflow-x-auto pt-3 pb-1">
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
                  <div key={b.n} className="flex-1 min-w-[60px] text-center p-1.5 rounded"
                    style={{ backgroundColor: b.c + '15', border: `1px solid ${b.c}30` }}>
                    <span className="text-sm">{b.i}</span>
                    <p className="text-[8px] font-bold mt-0.5" style={{ color: b.c === '#1A1030' ? '#1A1030' : b.c }}>{b.n}</p>
                    <p className="text-[7px] text-gray-400">{b.v}+</p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* TENDENCIAS: colapsables */}
          {vista === 'tendencias' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <CollapsibleSection title="Ventas y contactos por día" icon={<TrendingUp size={14} className="text-blue-400" />}>
                  <div className="space-y-1 pt-2">
                    {data.diarias.map(d => {
                      const maxV = Math.max(1, ...data.diarias.map(x => Math.max(x.ventas, x.contactados)));
                      return (
                        <div key={d.fecha} className="flex items-center gap-2">
                          <span className="text-[9px] text-gray-500 w-14 text-right">{d.fecha?.slice(5)}</span>
                          <div className="flex-1 flex items-center gap-0.5 h-4">
                            <div className="h-full bg-blue-400 rounded-l" style={{ width: `${(d.contactados / maxV) * 100}%`, minWidth: d.contactados > 0 ? '2px' : 0 }} />
                            <div className="h-full bg-[#481163] rounded-r" style={{ width: `${(d.ventas / maxV) * 100}%`, minWidth: d.ventas > 0 ? '2px' : 0 }} />
                          </div>
                          <span className="text-[9px] font-mono w-6 text-right">{d.contactados + d.ventas}</span>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Actividad por hora" icon={<Clock size={14} className="text-[#0a6ea9]" />}>
                  <div className="space-y-1 pt-2">
                    {data.porHora.map(h => {
                      const maxL = Math.max(1, ...data.porHora.map(x => x.total_llamadas));
                      const intensidad = h.total_llamadas / maxL;
                      return (
                        <div key={h.hora} className="flex items-center gap-2">
                          <span className="text-[9px] font-mono w-8">{h.hora}:00</span>
                          <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: `rgba(10,110,169,${intensidad * 0.2})` }}>
                            <div className="h-full bg-[#0a6ea9] rounded-full" style={{ width: `${intensidad * 100}%` }} />
                          </div>
                          <span className="text-[9px] font-bold w-5 text-right">{h.total_llamadas}</span>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleSection>
              </div>

              <CollapsibleSection title="Comparativa semanal" icon={<TrendingUp size={14} className="text-emerald-500" />}>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="text-[10px] text-gray-500">Ventas semana</p>
                      <p className="text-lg font-bold">{data.tendencias.ventas.actual}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500">Anterior</p>
                      <p className="text-sm text-gray-400">{data.tendencias.ventas.anterior}</p>
                    </div>
                    <div className={`text-sm font-bold ${data.tendencias.ventas.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {data.tendencias.ventas.delta >= 0 ? '+' : ''}{data.tendencias.ventas.delta}%
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="text-[10px] text-gray-500">Contactados semana</p>
                      <p className="text-lg font-bold">{data.tendencias.contactados.actual}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500">Anterior</p>
                      <p className="text-sm text-gray-400">{data.tendencias.contactados.anterior}</p>
                    </div>
                    <div className={`text-sm font-bold ${data.tendencias.contactados.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {data.tendencias.contactados.delta >= 0 ? '+' : ''}{data.tendencias.contactados.delta}%
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KPI({ icon: Icon, label, value, color, delta }: any) {
  return (
    <div className="card text-center py-3 relative">
      <Icon size={20} className={`mx-auto mb-1 ${color}`} />
      <div className="flex items-center justify-center gap-1">
        <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
        {delta}
      </div>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function DetailBadge({ label, value, color = 'text-gray-700 dark:text-gray-300' }: { label: string; value: any; color?: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
      <p className="text-[9px] text-gray-400">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}
