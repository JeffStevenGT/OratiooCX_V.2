/**
 * app/(dashboard)/estadisticas/page.tsx — Centro de Estadísticas (v4 UX)
 * Solo 4 KPIs visibles. Time tabs (Hoy/Semana/Mes). Secciones colapsables.
 * Vista por rol: asesor ve solo sus datos, supervisor/jefe ve equipo.
 */

'use client';

import { useState } from 'react';
import { BarChart3, TrendingUp, PhoneCall, Target, Users, Download, Filter, Clock, XCircle, PhoneOff, Pause, ChevronDown, ChevronRight } from 'lucide-react';
import { PageSkeleton } from '@/components/shared/Skeleton';
import FlipCard from '@/components/shared/FlipCard';
import CollapsibleSection from '@/components/shared/CollapsibleSection';
import TimeTabs, { timePresetToRange } from '@/components/shared/TimeTabs';
import { useAPI, apiUrl } from '@/hooks/useSWR';
import { useEquipos } from '@/hooks/useEquipos';
import { useSession } from '@/hooks/useSession';

const PAGE_SIZES = [10, 25, 50, 100];

type Stats = {
  kpi: { pendientes: number; contactados: number; interesados: number; ventas: number; no_interesa: number; no_contesta: number; total_asignados: number; efectividad: number; contactabilidad: number };
  codificacion: { promedio: string; segundos: number; total: number };
  hastaLlamada: { promedio: string; segundos: number; total: number };
  porDia: { dia: string; total: number; contactados: number; ventas: number }[];
  porAsesor: { nombre: string; equipo: string; total: number; contactados: number; ventas: number; no_interesa: number; no_contesta: number; pendientes: number }[];
  porHora: { hora: number; total: number; contactados: number; ventas: number }[];
  tiemposAsesor: { nombre: string; total_llamadas: number; wrap_up: string; wrap_up_seg: number; hasta_llamar: string; hasta_llamar_seg: number; pausa: string; pausa_seg: number; pausa_count: number; llamada: string; llamada_seg: number }[];
};

export default function EstadisticasPage() {
  const { role } = useSession();
  const isAsesor = role === 'asesor';
  const [timePreset, setTimePreset] = useState('semana');
  const { desde, hasta } = timePresetToRange(timePreset);
  const [equipo, setEquipo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { equipos } = useEquipos();

  const url = apiUrl('/api/pipeline/estadisticas', { desde, hasta, equipo });
  const { data: stats, isLoading } = useAPI<Stats>(url);

  const exportCSV = () => {
    if (!stats?.porAsesor) return;
    const headers = 'Asesor,Equipo,Total,Contactados,Ventas,No Interesa,No Contesta,Pendientes';
    const rows = stats.porAsesor.map(a => `${a.nombre},${a.equipo},${a.total},${a.contactados},${a.ventas},${a.no_interesa},${a.no_contesta},${a.pendientes}`);
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = u; a.download = `estadisticas_${desde}_${hasta}.csv`; a.click();
    URL.revokeObjectURL(u);
  };

  const maxBar = Math.max(1, ...(stats?.porDia.map(d => d.total) || [1]));
  const maxVentas = Math.max(1, ...(stats?.porAsesor.map(a => a.ventas) || [1]));

  const asesoresAll = stats?.porAsesor || [];
  const totalAPages = Math.ceil(asesoresAll.length / pageSize);
  const asesoresPaged = asesoresAll.slice((page - 1) * pageSize, page * pageSize);

  // ── Vista asesor: solo sus propios datos ──
  if (isAsesor && stats) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><BarChart3 size={22} className="text-[#0a6ea9]" />Mi Rendimiento</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Tus métricas personales</p>
          </div>
          <TimeTabs value={timePreset} onChange={setTimePreset} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MiniKPI icon={PhoneCall} label="Contactados" value={stats.kpi.contactados} color="text-emerald-600" />
          <MiniKPI icon={Target} label="Ventas" value={stats.kpi.ventas} color="text-[#481163]" />
          <MiniKPI icon={TrendingUp} label="Efectividad" value={`${stats.kpi.efectividad}%`} color="text-amber-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header: título + time tabs + export */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><BarChart3 size={22} className="text-[#0a6ea9]" />Estadísticas</h1>
        </div>
        <div className="flex items-center gap-3">
          <TimeTabs value={timePreset} onChange={v => { setTimePreset(v); setPage(1); }} />
          <button onClick={exportCSV} disabled={!stats}
            className="flex items-center gap-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50 dark:bg-gray-800 disabled:opacity-40">
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {isLoading ? <PageSkeleton /> : !stats ? (
        <div className="text-center py-20"><BarChart3 size={48} className="text-gray-400 dark:text-gray-500 mx-auto mb-4" /><p className="text-sm text-gray-500 dark:text-gray-400">Sin datos</p></div>
      ) : (
        <>
          {/* ── Solo 4 KPIs visibles ── */}
          <div className="grid grid-cols-4 gap-3">
            <FlipCard back="Total de leads asignados en el período">
              <KPI icon={Users} label="Asignados" value={stats.kpi.total_asignados} color="text-blue-600" />
            </FlipCard>
            <FlipCard back="Leads contactados exitosamente">
              <KPI icon={PhoneCall} label="Contactados" value={stats.kpi.contactados} color="text-emerald-600" />
            </FlipCard>
            <FlipCard back="Ventas cerradas en el período">
              <KPI icon={Target} label="Ventas" value={stats.kpi.ventas} color="text-[#481163]" />
            </FlipCard>
            <FlipCard back="% ventas sobre contactados">
              <KPI icon={TrendingUp} label="Efectividad" value={`${stats.kpi.efectividad}%`} color="text-amber-600" />
            </FlipCard>
          </div>

          {/* ── Filtro rápido por equipo ── */}
          {equipos.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter size={12} className="text-gray-400" />
              <select value={equipo} onChange={e => { setEquipo(e.target.value); setPage(1); }}
                className="border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-xs bg-white">
                <option value="">Todos los equipos</option>
                {equipos.map(eq => <option key={eq} value={eq}>{eq}</option>)}
              </select>
            </div>
          )}

          {/* ── Todo lo demás COLAPSADO ── */}

          {/* Negativos */}
          <CollapsibleSection title="Indicadores de abandono" icon={<XCircle size={14} className="text-red-400" />}
            badge={`${stats.kpi.no_interesa} NI · ${stats.kpi.no_contesta} NC`}>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-red-600">{stats.kpi.no_interesa}</p>
                <p className="text-[10px] text-red-500">No Interesa</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-amber-600">{stats.kpi.no_contesta}</p>
                <p className="text-[10px] text-amber-500">No Contesta</p>
              </div>
            </div>
          </CollapsibleSection>

          {/* Tiempos operativos */}
          <CollapsibleSection title="Tiempos operativos" icon={<Clock size={14} className="text-[#0a6ea9]" />}>
            <div className="grid grid-cols-4 gap-3 pt-2">
              <TimeCard label="Codificación" value={stats.codificacion.promedio} detail={`${stats.codificacion.total} tipificaciones`} />
              <TimeCard label="Hasta 1ª llamada" value={stats.hastaLlamada.promedio} detail={`${stats.hastaLlamada.total} leads`} />
              <TimeCard label="Tiempo en pausa" value={(() => {
                const s = (stats.tiemposAsesor || []).reduce((a: number, t: any) => a + (t.pausa_seg || 0), 0);
                return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s/60)}min` : `${Math.round(s/3600)}h`;
              })()} detail="Total del equipo" />
              <TimeCard label="Tiempo hablando" value={(() => {
                const s = (stats.tiemposAsesor || []).reduce((a: number, t: any) => a + (t.llamada_seg || 0), 0);
                return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s/60)}min` : `${Math.round(s/3600)}h`;
              })()} detail="CDR VPBX" />
            </div>
          </CollapsibleSection>

          {/* Gráficos */}
          <div className="grid grid-cols-2 gap-4">
            <CollapsibleSection title="Actividad por día" icon={<BarChart3 size={14} className="text-blue-400" />}>
              <div className="space-y-1.5 pt-2">
                {stats.porDia.map(d => (
                  <div key={d.dia} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 w-14 text-right">
                      {new Date(d.dia + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' })}
                    </span>
                    <div className="flex-1 flex items-center gap-0.5 h-4">
                      <div className="h-full bg-blue-400 rounded-l" style={{ width: `${(d.contactados / maxBar) * 100}%`, minWidth: d.contactados > 0 ? '3px' : 0 }} />
                      <div className="h-full bg-[#481163] rounded-r" style={{ width: `${(d.ventas / maxBar) * 100}%`, minWidth: d.ventas > 0 ? '3px' : 0 }} />
                    </div>
                    <span className="text-[9px] font-mono w-8">{d.total}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Franja horaria" icon={<Clock size={14} className="text-[#481163]/70" />}>
              <div className="space-y-1 pt-2">
                {Array.from({ length: 14 }, (_, i) => i + 8).map(h => {
                  const d = stats.porHora.find(x => x.hora === h) || { total: 0, contactados: 0, ventas: 0 };
                  const maxH = Math.max(1, ...stats.porHora.map(x => x.total));
                  return (
                    <div key={h} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 w-10 text-right">{h}:00</span>
                      <div className="flex-1 h-3 bg-gray-50 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-400 to-[#481163] rounded-full" style={{ width: `${(d.total / maxH) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-mono w-6">{d.total}</span>
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          </div>

          {/* Tabla por asesor (colapsada, es pesada) */}
          <CollapsibleSection title={`Rendimiento por asesor (${asesoresAll.length})`}
            icon={<Users size={14} className="text-[#0a6ea9]" />}
            badge={stats.kpi.ventas + ' ventas'}>
            <div className="overflow-x-auto pt-2">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <th className="px-2 py-1.5 text-left text-[10px] text-gray-500">Asesor</th>
                    <th className="px-2 py-1.5 text-left text-[10px] text-gray-500">Eq.</th>
                    <th className="px-2 py-1.5 text-center text-[10px] text-gray-500">Total</th>
                    <th className="px-2 py-1.5 text-center text-[10px] text-gray-500">Cont.</th>
                    <th className="px-2 py-1.5 text-center text-[10px] text-gray-500">Ventas</th>
                    <th className="px-2 py-1.5 text-center text-[10px] text-gray-500">Éxito</th>
                  </tr>
                </thead>
                <tbody>
                  {asesoresPaged.map(a => {
                    const pct = a.total > 0 ? Math.round((a.ventas / a.total) * 100) : 0;
                    return (
                      <tr key={a.nombre} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-800 text-[11px]">
                        <td className="py-1.5 px-2 font-medium">{a.nombre}</td>
                        <td className="py-1.5 px-2 text-gray-500">{a.equipo}</td>
                        <td className="py-1.5 px-2 text-center font-bold">{a.total}</td>
                        <td className="py-1.5 px-2 text-center">{a.contactados}</td>
                        <td className="py-1.5 px-2 text-center font-bold text-emerald-600">{a.ventas}</td>
                        <td className="py-1.5 px-2 text-center">
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${pct >= 20 ? 'bg-emerald-100 text-emerald-700' : pct >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{pct}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {totalAPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <select value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1); }}
                    className="border border-gray-200 rounded px-2 py-1 text-[10px]">
                    {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="text-[10px] px-2 py-1 border rounded disabled:opacity-30">Anterior</button>
                    <span className="text-[10px] text-gray-500">{page}/{totalAPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalAPages, p + 1))} disabled={page === totalAPages}
                      className="text-[10px] px-2 py-1 border rounded disabled:opacity-30">Siguiente</button>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Tiempos por asesor */}
          <CollapsibleSection title="Tiempos por asesor" icon={<Clock size={14} className="text-amber-500" />}>
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <th className="px-2 py-1.5 text-left text-[10px] text-gray-500">Asesor</th>
                    <th className="px-2 py-1.5 text-center text-[10px] text-gray-500">Llamadas</th>
                    <th className="px-2 py-1.5 text-center text-[10px] text-gray-500">Wrap-up</th>
                    <th className="px-2 py-1.5 text-center text-[10px] text-gray-500">1ª Llam.</th>
                    <th className="px-2 py-1.5 text-center text-[10px] text-gray-500">Pausa</th>
                    <th className="px-2 py-1.5 text-center text-[10px] text-gray-500">Hablando</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats.tiemposAsesor || []).map((t: any) => (
                    <tr key={t.nombre} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-800">
                      <td className="py-1.5 px-2 font-medium">{t.nombre}</td>
                      <td className="py-1.5 px-2 text-center font-bold">{t.total_llamadas}</td>
                      <td className="py-1.5 px-2 text-center">{t.wrap_up}</td>
                      <td className="py-1.5 px-2 text-center">{t.hasta_llamar}</td>
                      <td className="py-1.5 px-2 text-center">{t.pausa}{t.pausa_count > 0 ? <span className="text-[8px] text-slate-400 block">{t.pausa_count}x</span> : null}</td>
                      <td className="py-1.5 px-2 text-center">{t.llamada}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        </>
      )}
    </div>
  );
}

function KPI({ icon: Icon, label, value, color }: any) {
  return (
    <div className="card text-center py-3">
      <Icon size={20} className={`mx-auto mb-1 ${color}`} />
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function MiniKPI({ icon: Icon, label, value, color }: any) {
  return (
    <div className="card text-center py-6">
      <Icon size={24} className={`mx-auto mb-2 ${color}`} />
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
}

function TimeCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-[9px] text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-[8px] text-gray-400 dark:text-gray-500 mt-0.5">{detail}</p>
    </div>
  );
}
