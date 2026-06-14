'use client';

import { useState, useEffect } from 'react';
import { Users, Phone, Target, AlertTriangle, UserCheck, Pause, ChevronDown, ChevronRight } from 'lucide-react';
import FlipCard from '@/components/shared/FlipCard';
import LivePanel from '@/components/shared/LivePanel';

type AsesorStats = { id: number; nombre: string; equipo: string; pendientes: number; contactados: number; porVencer: number };
type GlobalStats = { sinAsignar: number; liberados: number; totalAsesores: number; totalContactadosHoy: number };

export default function SupervisorDashboard() {
  const [global, setGlobal] = useState<GlobalStats | null>(null);
  const [asesores, setAsesores] = useState<AsesorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [leadsExpand, setLeadsExpand] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/pipeline/notifications?user_id=0&rol=supervisor');
        const data = await res.json();
        const usuariosRes = await fetch('/api/usuarios?rol=asesor');
        const usuarios = await usuariosRes.json();
        const asesoresStats = await Promise.all(usuarios.map(async (a: any) => {
          const aRes = await fetch(`/api/pipeline/notifications?user_id=${a.id}&rol=asesor`);
          const aData = await aRes.json();
          return { id: a.id, nombre: a.nombre, equipo: a.equipo || '—', pendientes: aData.totalPendientes || 0, contactados: aData.totalContactados || 0, porVencer: aData.porVencer || 0 };
        }));
        setGlobal({ sinAsignar: data.sinAsignar || 0, liberados: data.liberados || 0, totalAsesores: usuarios.length, totalContactadosHoy: asesoresStats.reduce((s, a) => s + a.contactados, 0) });
        setAsesores(asesoresStats);
      } catch { /* */ }
      setLoading(false);
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const expandAsesor = async (aId: number) => {
    if (expanded === aId) { setExpanded(null); return; }
    setExpanded(aId); setLoadingLeads(true);
    try { const res = await fetch(`/api/pipeline?asesor_id=${aId}&limit=50`); setLeadsExpand(await res.json()); } catch { /* */ }
    setLoadingLeads(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dashboard Supervisor</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Visión de tu equipo</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-4 gap-4">
        <FlipCard back="Leads sin asignar a asesores"><MiniCard icon={Target} label="Sin Asignar" value={global?.sinAsignar || 0} color="text-amber-600" loading={loading} /></FlipCard>
        <FlipCard back="Leads liberados hoy al pool"><MiniCard icon={AlertTriangle} label="Liberados Hoy" value={global?.liberados || 0} color="text-red-600" loading={loading} /></FlipCard>
        <FlipCard back="Total de asesores activos"><MiniCard icon={Users} label="Asesores" value={global?.totalAsesores || 0} color="text-blue-600" loading={loading} /></FlipCard>
        <FlipCard back="Contactos realizados hoy"><MiniCard icon={Phone} label="Contactados Hoy" value={global?.totalContactadosHoy || 0} color="text-emerald-600" loading={loading} /></FlipCard>
      </div>

      <LivePanel />

      {/* Tabla de asesores con drill-down */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-900 dark:text-white"><UserCheck size={16} className="text-[#0a6ea9]" /> Rendimiento del equipo</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="animate-spin w-5 h-5 border-2 border-[#0a6ea9] border-t-transparent rounded-full" /></div>
        ) : asesores.length === 0 ? (
          <div className="text-center py-12"><Users size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" /><p className="text-sm text-gray-400">Sin asesores en tu equipo</p></div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Asesor</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Equipo</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Pend.</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Contact.</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Vencen</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody>
                {asesores.map(a => (
                  [<tr key={a.id} onClick={() => expandAsesor(a.id)}
                    className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                    <td className="py-2.5 px-4 text-xs font-medium text-gray-900 dark:text-white">{a.nombre}</td>
                    <td className="py-2.5 px-4 text-xs text-gray-500 dark:text-gray-400">{a.equipo}</td>
                    <td className="py-2.5 px-4 text-xs text-center font-bold text-gray-900 dark:text-white">{a.pendientes}</td>
                    <td className="py-2.5 px-4 text-xs text-center text-gray-700 dark:text-gray-300">{a.contactados}</td>
                    <td className="py-2.5 px-4 text-xs text-center"><span className={a.porVencer > 0 ? 'text-red-500 font-bold' : 'text-gray-400'}>{a.porVencer}</span></td>
                    <td className="py-2.5 px-4 text-center"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                      a.pendientes === 0 ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' :
                      a.porVencer > 0 ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400' :
                      a.contactados > 0 ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>{a.pendientes === 0 ? 'Al día' : a.porVencer > 0 ? '⚠️ Urgente' : a.contactados > 0 ? 'Activo' : 'Pendiente'}</span></td>
                  </tr>,
                  expanded === a.id && <tr key={`exp-${a.id}`}>
                    <td colSpan={6} className="p-0">
                      <div className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 px-6 py-3">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Leads de {a.nombre} ({leadsExpand.length})</p>
                        {loadingLeads ? (
                          <div className="flex justify-center py-4"><div className="animate-spin w-4 h-4 border-2 border-[#0a6ea9] border-t-transparent rounded-full" /></div>
                        ) : leadsExpand.length === 0 ? (
                          <p className="text-xs text-gray-400 py-4 text-center">Sin leads asignados</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-[10px]">
                              <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="px-2 py-1.5 text-left text-gray-400 font-medium">DNI</th>
                                <th className="px-2 py-1.5 text-left text-gray-400 font-medium">Nombre</th>
                                <th className="px-2 py-1.5 text-center text-gray-400 font-medium">Estado</th>
                                <th className="px-2 py-1.5 text-center text-gray-400 font-medium">Int.</th>
                              </tr></thead>
                              <tbody>{leadsExpand.map((l: any) => (
                                <tr key={l.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-white dark:hover:bg-gray-700">
                                  <td className="px-2 py-1.5 font-mono text-gray-500">{l.dni}</td>
                                  <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{l.nombre || '—'}</td>
                                  <td className="px-2 py-1.5 text-center"><span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                                    l.estado === 'venta' ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' :
                                    l.estado === 'pendiente' ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' :
                                    'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                  }`}>{l.estado}</span></td>
                                  <td className="px-2 py-1.5 text-center text-gray-500">{l.intentos || 0}</td>
                                </tr>
                              ))}</tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ]))}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
              <p className="text-[10px] text-gray-400 text-center">Click en un asesor para ver sus leads</p>
            </div>
          </>
        )}
      </div>

      <PausasResumen />
    </div>
  );
}

function MiniCard({ icon: Icon, label, value, color, loading }: any) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 text-center">
      <Icon size={22} className={`mx-auto mb-2 ${color}`} />
      {loading ? <div className="w-10 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto" /> : <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>}
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
}

function PausasResumen() {
  const [pausas, setPausas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => { try { const r = await fetch('/api/pausas?equipo=1&hoy=1'); if (r.ok) setPausas(await r.json()); } catch { /* */ } setLoading(false); })(); }, []);

  const porUsuario: Record<string, { nombre: string; equipo: string; pausas: any[]; totalSeg: number }> = {};
  for (const p of pausas) {
    if (!porUsuario[p.usuario_id]) porUsuario[p.usuario_id] = { nombre: p.nombre, equipo: p.equipo, pausas: [], totalSeg: 0 };
    porUsuario[p.usuario_id].pausas.push(p);
    if (p.duracion_segundos) porUsuario[p.usuario_id].totalSeg += p.duracion_segundos;
  }
  const fmt = (s: number) => s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}min` : `${Math.round(s / 3600)}h`;
  if (loading || pausas.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Pause size={15} className="text-amber-500" /> Pausas del día</h3>
        <span className="text-[10px] text-gray-400">{pausas.length} pausas · {fmt(pausas.reduce((s: number, p: any) => s + (p.duracion_segundos || 0), 0))} total</span>
      </div>
      <table className="w-full text-xs">
        <thead><tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
          <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase">Asesor</th>
          <th className="px-4 py-2 text-center text-[10px] font-semibold text-gray-400 uppercase">Pausas</th>
          <th className="px-4 py-2 text-center text-[10px] font-semibold text-gray-400 uppercase">Tiempo</th>
          <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase">Tipos</th>
        </tr></thead>
        <tbody>{Object.entries(porUsuario).map(([uid, data]) => {
          const tipos = [...new Set(data.pausas.map((p: any) => p.tipo))];
          const labels: Record<string,string> = {bano:'Baño',almuerzo:'Almuerzo',descanso:'Descanso',reunion:'Reunión',capacitacion:'Capacitación',otro:'Otro'};
          const c = data.totalSeg < 300 ? 'text-amber-500' : data.totalSeg < 900 ? 'text-orange-500' : data.totalSeg < 1800 ? 'text-orange-600' : 'text-red-500';
          return <tr key={uid} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
            <td className="py-2.5 px-4 font-medium text-gray-900 dark:text-white">{data.nombre}</td>
            <td className="py-2.5 px-4 text-center text-gray-500">{data.pausas.length}</td>
            <td className={`py-2.5 px-4 text-center font-mono font-bold ${c}`}>{fmt(data.totalSeg)}</td>
            <td className="py-2.5 px-4"><div className="flex flex-wrap gap-1">{tipos.map((t: string) => <span key={t} className="text-[9px] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">{labels[t] || t}</span>)}</div></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}
