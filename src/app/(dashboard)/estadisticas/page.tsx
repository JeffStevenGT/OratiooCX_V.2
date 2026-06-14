/**
 * app/(dashboard)/estadisticas/page.tsx — Centro de Estadísticas
 */

'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Phone, Target, Users, Download, Loader2, Calendar, Filter, PhoneCall, PhoneOff, Clock, CheckCircle2, XCircle, Pause } from 'lucide-react';
import Skeleton, { TableSkeleton, PageSkeleton } from '@/components/shared/Skeleton';
import FlipCard from '@/components/shared/FlipCard';

const PAGE_SIZES = [10, 25, 50, 100];

type Stats = {
  kpi: { pendientes: number; contactados: number; interesados: number; ventas: number; no_interesa: number; no_contesta: number; total_asignados: number; efectividad: number; contactabilidad: number };
  llamadas: { total_llamadas: number; contestadas: number; no_contestan: number; buzon: number };
  codificacion: { promedio: string; segundos: number; total: number };
  hastaLlamada: { promedio: string; segundos: number; total: number };
  porDia: { dia: string; total: number; contactados: number; ventas: number }[];
  porAsesor: { nombre: string; equipo: string; total: number; contactados: number; ventas: number; no_interesa: number; no_contesta: number; pendientes: number }[];
  porHora: { hora: number; total: number; contactados: number; ventas: number }[];
  tiemposAsesor: { nombre: string; total_llamadas: number; wrap_up: string; wrap_up_seg: number; hasta_llamar: string; hasta_llamar_seg: number; pausa: string; pausa_seg: number; pausa_count: number; llamada: string; llamada_seg: number }[];
};

export default function EstadisticasPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
  const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0]);
  const [equipo, setEquipo] = useState('');
  const [equipos, setEquipos] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ desde, hasta });
      if (equipo) params.set('equipo', equipo);
      const res = await fetch(`/api/pipeline/estadisticas?${params}`);
      setStats(await res.json());
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => {
    fetch('/api/usuarios?rol=asesor').then(r => r.json()).then(users => {
      setEquipos([...new Set(users.map((u: any) => u.equipo).filter(Boolean))] as string[]);
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchStats(); setPage(1); }, [desde, hasta, equipo]);

  const exportCSV = () => {
    if (!stats?.porAsesor) return;
    const headers = 'Asesor,Equipo,Total,Contactados,Ventas,No Interesa,No Contesta,Pendientes';
    const rows = stats.porAsesor.map(a => `${a.nombre},${a.equipo},${a.total},${a.contactados},${a.ventas},${a.no_interesa},${a.no_contesta},${a.pendientes}`);
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `estadisticas_${desde}_${hasta}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const maxBar = Math.max(1, ...(stats?.porDia.map(d => d.total) || [1]));
  const maxVentas = Math.max(1, ...(stats?.porAsesor.map(a => a.ventas) || [1]));

  const asesoresAll = stats?.porAsesor || [];
  const totalAPages = Math.ceil(asesoresAll.length / pageSize);
  const asesoresPaged = asesoresAll.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><BarChart3 size={22} className="text-[#0a6ea9]" />Estadísticas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Indicadores clave del negocio</p>
        </div>
        <button onClick={exportCSV} disabled={!stats}
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
        <button onClick={fetchStats} className="text-xs text-[#0a6ea9] hover:underline">Actualizar</button>
      </div>

      {loading ? (
        <PageSkeleton />
      ) : !stats ? (
        <div className="text-center py-20"><BarChart3 size={48} className="text-gray-400 dark:text-gray-500 mx-auto mb-4" /><p className="text-sm text-gray-500 dark:text-gray-400">Sin datos</p></div>
      ) : (
        <>
          {/* KPIs principales */}
          <div className="grid grid-cols-5 gap-3">
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
            <FlipCard back="% contactados sobre asignados">
              <KPI icon={CheckCircle2} label="Contactabilidad" value={`${stats.kpi.contactabilidad}%`} color="text-purple-600" />
            </FlipCard>
          </div>

          {/* Tiempos por asesor */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Clock size={16} className="text-[#0a6ea9]" /> Tiempos por asesor</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <th className="table-header px-3 py-2 text-left text-xs">Asesor</th>
                    <th className="table-header px-3 py-2 text-center text-xs">Llamadas</th>
                    <th className="table-header px-3 py-2 text-center text-xs">Wrap-up</th>
                    <th className="table-header px-3 py-2 text-center text-xs">1ª Llam.</th>
                    <th className="table-header px-3 py-2 text-center text-xs">En pausa</th>
                    <th className="table-header px-3 py-2 text-center text-xs">Hablando</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats.tiemposAsesor || []).map((t: any) => (
                    <tr key={t.nombre} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-800 text-xs">
                      <td className="py-2 px-3 font-medium">{t.nombre}</td>
                      <td className="py-2 px-3 text-center font-bold">{t.total_llamadas}</td>
                      <td className="py-2 px-3 text-center">{t.wrap_up}</td>
                      <td className="py-2 px-3 text-center">{t.hasta_llamar}</td>
                      <td className="py-2 px-3 text-center">{t.pausa}{t.pausa_count > 0 ? <span className="text-[9px] text-slate-400 block">{t.pausa_count} pausas</span> : null}</td>
                      <td className="py-2 px-3 text-center">{t.llamada}</td>
                    </tr>
                  ))}
                  {(!stats.tiemposAsesor || stats.tiemposAsesor.length === 0) && (
                    <tr><td colSpan={6} className="py-4 text-center text-xs text-gray-500 dark:text-gray-400">Sin datos de tiempos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Clock size={16} className="text-[#0a6ea9]" /> Tiempos operativos</h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <Clock size={16} className="text-amber-500 mb-1" />
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Codificación (wrap-up)</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.codificacion.promedio}</p>
                <p className="text-[9px] text-gray-400 dark:text-gray-500">Tiempo entre llamada y tipificación</p>
                <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-1">{stats.codificacion.total} tipificaciones</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <Phone size={16} className="text-blue-500 mb-1" />
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Hasta 1ª llamada</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.hastaLlamada.promedio}</p>
                <p className="text-[9px] text-gray-400 dark:text-gray-500">Desde asignación al primer intento</p>
                <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-1">{stats.hastaLlamada.total} leads</p>
              </div>
              {(() => {
                const totalPausa = (stats.tiemposAsesor || []).reduce((s: number, t: any) => s + (t.pausa_seg || 0), 0);
                const totalPausas = (stats.tiemposAsesor || []).reduce((s: number, t: any) => s + (t.pausa_count || 0), 0);
                const fmt = totalPausa < 60 ? `${totalPausa}s` : totalPausa < 3600 ? `${Math.round(totalPausa / 60)}min` : `${Math.round(totalPausa / 3600)}h`;
                return (
                  <div className={`rounded-lg p-4 ${totalPausa > 0 ? 'bg-amber-50' : 'bg-gray-50 dark:bg-gray-800'}`}>
                    <Pause size={16} className={totalPausa > 0 ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500'} />
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Tiempo en pausa</p>
                    <p className={`text-lg font-bold ${totalPausa > 0 ? 'text-amber-700' : 'text-gray-400 dark:text-gray-500'}`}>{totalPausa > 0 ? fmt : '—'}</p>
                    <p className="text-[9px] text-gray-400 dark:text-gray-500">Baño, almuerzo, descanso, etc.</p>
                    <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-1">{totalPausas} pausas total</p>
                  </div>
                );
              })()}
              {(() => {
                const totalHablando = (stats.tiemposAsesor || []).reduce((s: number, t: any) => s + (t.llamada_seg || 0), 0);
                const fmt = totalHablando < 60 ? `${totalHablando}s` : totalHablando < 3600 ? `${Math.round(totalHablando / 60)}min` : `${Math.round(totalHablando / 3600)}h`;
                return (
                  <div className={`rounded-lg p-4 ${totalHablando > 0 ? 'bg-blue-50' : 'bg-gray-50 dark:bg-gray-800 opacity-60'}`}>
                    <PhoneCall size={16} className={totalHablando > 0 ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'} />
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Tiempo hablando</p>
                    <p className={`text-lg font-bold ${totalHablando > 0 ? 'text-blue-700' : 'text-gray-400 dark:text-gray-500'}`}>{totalHablando > 0 ? fmt : '—'}</p>
                    <p className="text-[9px] text-gray-400 dark:text-gray-500">{totalHablando > 0 ? 'Segundos de conversación (CDR)' : 'Requiere VPBX conectado'}</p>
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <FlipCard back="Leads que no mostraron interés">
              <KPI icon={XCircle} label="No Interesa" value={stats.kpi.no_interesa} color="text-red-500" />
            </FlipCard>
            <FlipCard back="Leads que no contestaron llamadas">
              <KPI icon={PhoneOff} label="No Contesta" value={stats.kpi.no_contesta} color="text-amber-500" />
            </FlipCard>
            <FlipCard back="Leads pendientes de contacto">
              <KPI icon={Clock} label="Pendientes" value={stats.kpi.pendientes} color="text-gray-500" />
            </FlipCard>
            <FlipCard back="Leads con interés manifestado">
              <KPI icon={BarChart3} label="Interesados" value={stats.kpi.interesados} color="text-blue-400" />
            </FlipCard>
          </div>

          {/* Llamadas */}
          {stats.llamadas.total_llamadas > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Phone size={16} className="text-[#0a6ea9]" /> Llamadas</h3>
              <div className="grid grid-cols-4 gap-3">
                <FlipCard back="Total de llamadas realizadas">
                  <MiniStat label="Total" value={stats.llamadas.total_llamadas} />
                </FlipCard>
                <FlipCard back="Llamadas que fueron contestadas">
                  <MiniStat label="Contestadas" value={stats.llamadas.contestadas} color="text-emerald-600" />
                </FlipCard>
                <FlipCard back="Llamadas sin respuesta">
                  <MiniStat label="No contestan" value={stats.llamadas.no_contestan} color="text-red-500" />
                </FlipCard>
                <FlipCard back="Llamadas que fueron a buzón">
                  <MiniStat label="Buzón" value={stats.llamadas.buzon} color="text-gray-500" />
                </FlipCard>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            {/* Gráfico: Por día */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-4">Actividad por día</h3>
              <div className="space-y-2">
                {stats.porDia.map(d => (
                  <div key={d.dia} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 w-16 text-right">
                      {new Date(d.dia + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' })}
                    </span>
                    <div className="flex-1 flex items-center gap-0.5 h-5">
                      <div className="h-full bg-blue-400 rounded-l" style={{ width: `${(d.contactados / maxBar) * 100}%`, minWidth: d.contactados > 0 ? '4px' : 0 }} title={`Contactados: ${d.contactados}`} />
                      <div className="h-full bg-[#481163] rounded-r" style={{ width: `${(d.ventas / maxBar) * 100}%`, minWidth: d.ventas > 0 ? '4px' : 0 }} title={`Ventas: ${d.ventas}`} />
                    </div>
                    <span className="text-[10px] font-mono w-10">{d.total}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded" /> Contactados</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-[#481163] rounded" /> Ventas</span>
              </div>
            </div>

            {/* Gráfico: Por hora */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-4">Franja horaria</h3>
              <div className="space-y-1">
                {Array.from({ length: 14 }, (_, i) => i + 8).map(h => {
                  const d = stats.porHora.find(x => x.hora === h) || { total: 0, contactados: 0, ventas: 0 };
                  const maxH = Math.max(1, ...stats.porHora.map(x => x.total));
                  return (
                    <div key={h} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 w-10 text-right">{h}:00</span>
                      <div className="flex-1 h-4 bg-gray-50 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-400 to-[#481163] rounded-full transition-all"
                          style={{ width: `${(d.total / maxH) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-mono w-8">{d.total}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tabla por asesor */}
          <div className="card !p-0 overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold">Rendimiento por asesor</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <th className="table-header px-3 py-2 text-left">Asesor</th>
                    <th className="table-header px-3 py-2 text-left">Equipo</th>
                    <th className="table-header px-3 py-2 text-center">Total</th>
                    <th className="table-header px-3 py-2 text-center">Contact.</th>
                    <th className="table-header px-3 py-2 text-center">Ventas</th>
                    <th className="table-header px-3 py-2 text-center">% Éxito</th>
                    <th className="table-header px-3 py-2 text-center">No Int.</th>
                    <th className="table-header px-3 py-2 text-center">No Cont.</th>
                    <th className="table-header px-3 py-2">Progreso</th>
                  </tr>
                </thead>
                <tbody>
                  {asesoresPaged.map(a => {
                    const pct = a.total > 0 ? Math.round((a.ventas / a.total) * 100) : 0;
                    return (
                      <tr key={a.nombre} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-800 text-xs">
                        <td className="py-2 px-3 font-medium">{a.nombre}</td>
                        <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{a.equipo}</td>
                        <td className="py-2 px-3 text-center font-bold">{a.total}</td>
                        <td className="py-2 px-3 text-center">{a.contactados}</td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-600">{a.ventas}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${pct >= 20 ? 'bg-emerald-100 text-emerald-700' : pct >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{pct}%</span>
                        </td>
                        <td className="py-2 px-3 text-center text-red-500">{a.no_interesa}</td>
                        <td className="py-2 px-3 text-center text-amber-600">{a.no_contesta}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((a.ventas / maxVentas) * 100, 100)}%` }} />
                            </div>
                            <span className="text-[9px] w-6 text-right">{a.ventas}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {totalAPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Mostrar</span>
                    <select value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1); }}
                      className="border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-xs bg-white">
                      {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <span className="text-xs text-gray-500 dark:text-gray-400">de {asesoresAll.length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="btn-outline text-xs px-3 py-1 disabled:opacity-30">Anterior</button>
                    <span className="text-xs text-gray-500 dark:text-gray-400 px-2">{page} / {totalAPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalAPages, p + 1))} disabled={page === totalAPages}
                      className="btn-outline text-xs px-3 py-1 disabled:opacity-30">Siguiente</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {/* ── Info ── */}
      <div className="mt-8 card-sm bg-gray-50 dark:bg-gray-800 dark:bg-[#1e1a2a] border-dashed border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a]">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">💡 ¿Cómo funciona?</h3>
        <ul className="space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
          <li>· Métricas en tiempo real del pipeline: conversión, contacto, abandono. Filtra por período y equipo.</li>
        </ul>
      </div>
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

function MiniStat({ label, value, color }: any) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
      <p className={`text-lg font-bold ${color || 'text-gray-900 dark:text-white'}`}>{value}</p>
      <p className="text-[10px] text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
