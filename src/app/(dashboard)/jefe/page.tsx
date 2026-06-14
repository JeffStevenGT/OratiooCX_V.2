/**
 * app/(dashboard)/jefe/page.tsx — Dashboard del Jefe de Area (vision ejecutiva)
 */

'use client';

import { useState, useEffect } from 'react';
import { useProject } from '@/lib/project-context';
import { LayoutDashboard, Users, Target, TrendingUp, Globe, BarChart3, Bot, AlertTriangle, Loader2, Phone, Clock, Activity, CheckCircle2, UserPlus, ArrowRight, Eye, Layers, DollarSign, Shield, TrendingDown, Zap, Pause } from 'lucide-react';
import Skeleton, { TableSkeleton, PageSkeleton } from '@/components/shared/Skeleton';
import FlipCard from '@/components/shared/FlipCard';

const PAGE_SIZES = [10, 25, 50, 100];

type Stats = { totalClientes: number; pendientes: number; completados: number; enProgreso: number; noCliente: number; errores: number; sinAsignar: number; asignados: number; contactados: number; ventas: number; completadosHoy: number };
type EquipoStats = { equipo: string; asesores: number; pendientes: number; contactados: number; ventas: number; efectividad: number; qaPromedio: string };
type Funnel = { etapa: string; count: number; color: string };
type BotStatus = { workers: number; colaPendiente: number; colaProgreso: number; proxysActivos: number; maquina: string };

const DEFAULT_PARAMS: Record<string,string> = {
  meta_ventas_mes:'20', meta_contactos_mes:'200', cooldown_horas:'48',
  max_intentos:'5', dias_liberacion:'3', ingreso_estimado_venta:'35'
};

export default function JefeDashboard() {
  const { proyecto } = useProject();
  const [stats, setStats] = useState<Stats | null>(null);
  const [equipos, setEquipos] = useState<EquipoStats[]>([]);
  const [funnel, setFunnel] = useState<Funnel[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useState<Record<string,string>>({});
  const [paramsLoading, setParamsLoading] = useState(true);
  const [showParams, setShowParams] = useState(false);
  const [savingParams, setSavingParams] = useState(false);
  const [paramMsg, setParamMsg] = useState('');
  const [forecast, setForecast] = useState<any>(null);
  const [scoringResumen, setScoringResumen] = useState<any>(null);
  const [saludBase, setSaludBase] = useState<{total:number;limpios:number;porcentaje:number}|null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => { fetch('/api/configuracion').then(r=>r.json()).then(c=>{if(c&&!c.error)setParams(c);}).catch(()=>{}).finally(()=>setParamsLoading(false)); fetch('/api/dashboard/salud-base').then(r=>r.json()).then(d=>{if(d&&d.porcentaje!==undefined)setSaludBase(d);}).catch(()=>{}); fetch('/api/dashboard/forecast').then(r=>r.json()).then(d=>{if(d&&!d.error)setForecast(d);}).catch(()=>{}); fetch('/api/dashboard/scoring').then(r=>r.json()).then(d=>{if(d&&d.kpis)setScoringResumen(d.kpis);}).catch(()=>{}); },[]);

  useEffect(() => {
    if (!proyecto) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/dashboard/proyecto?proyecto=${proyecto.nombre}`).then(r => r.json()),
      fetch('/api/usuarios?rol=asesor').then(r => r.json()),
    ]).then(async ([s, users]) => {
      setStats(s);
      try {
        const colaRes = await fetch('/api/documentos/cola'); const cola = await colaRes.json();
        const maqRes = await fetch('/api/maquinas'); const maquinas = await maqRes.json();
        const online = Array.isArray(maquinas) ? maquinas.filter((m: any) => m.estado === 'online') : [];
        setBotStatus({ workers: online.reduce((s: number, m: any) => s + (m.workers_activos || 0), 0), colaPendiente: cola?.resumen?.pendiente || 0, colaProgreso: cola?.resumen?.en_progreso || 0, proxysActivos: 0, maquina: online.length > 0 ? `${online.length} online` : 'Sin conexion' });
        try { const pRes = await fetch('/api/proxies'); const pData = await pRes.json(); setBotStatus((prev: any) => ({ ...prev, proxysActivos: pData?.proxies?.length || 0 })); } catch {}
      } catch {}
      const equiposMap: Record<string, any[]> = {};
      for (const u of users) { const eq = u.equipo || 'Sin equipo'; if (!equiposMap[eq]) equiposMap[eq] = []; equiposMap[eq].push(u); }
      const eqStats: EquipoStats[] = [];
      for (const [eq, members] of Object.entries(equiposMap)) {
        const statsList = await Promise.all(members.map(async (u: any) => { const r = await fetch(`/api/pipeline/notifications?user_id=${u.id}&rol=asesor`); return await r.json(); }));
        const pendientes = statsList.reduce((s:number, x:any) => s + (x.totalPendientes || 0), 0);
        const contactados = statsList.reduce((s:number, x:any) => s + (x.totalContactados || 0), 0);
        const ventas = statsList.reduce((s:number, x:any) => s + (x.ventas || 0), 0);
        let qaPromedio = '--';
        try { const qaRes = await fetch('/api/qa', { method: 'PATCH' }); const qaData = await qaRes.json(); const eqQa = Array.isArray(qaData) ? qaData.filter((q: any) => members.some((m: any) => m.nombre === q.nombre) && q.total_evaluaciones > 0) : []; const avg = eqQa.length > 0 ? Math.round(eqQa.reduce((s: number, q: any) => s + (q.promedio || 0), 0) / eqQa.length) : null; qaPromedio = avg ? `${avg}/25` : '--'; } catch {}
        eqStats.push({ equipo: eq, asesores: members.length, pendientes, contactados, ventas, efectividad: Math.round((ventas / (pendientes + contactados + ventas || 1)) * 100), qaPromedio });
      }
      setEquipos(eqStats.sort((a, b) => b.ventas - a.ventas));
      setFunnel([ { etapa: 'Completados', count: s.completados || 0, color: 'bg-indigo-500' }, { etapa: 'Sin asignar', count: s.sinAsignar || 0, color: 'bg-amber-500' }, { etapa: 'Asignados', count: s.asignados || 0, color: 'bg-blue-500' }, { etapa: 'Contactados', count: s.contactados || 0, color: 'bg-emerald-500' }, { etapa: 'Ventas', count: s.ventas || 0, color: 'bg-[#481163]' } ]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [proyecto]);

  if (!proyecto) return null;
  const maxFunnel = Math.max(1, ...funnel.map(f => f.count));
  const totalVentas = stats?.ventas || 0;

  const eqTotal = Math.ceil(equipos.length / pageSize);
  const eqPaged = equipos.slice((page - 1) * pageSize, page * pageSize);
  
  

  const saveParams = async () => {
    setSavingParams(true);
    try { await fetch('/api/configuracion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) }); setParamMsg('Guardado'); }
    catch { setParamMsg('Error'); }
    setSavingParams(false); setTimeout(() => setParamMsg(''), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><LayoutDashboard size={22} className="text-[#0a6ea9]" />{proyecto.nombre_visible}</h1><p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Vision ejecutiva del proyecto</p></div>
        <div className="flex items-center gap-2"><a href="/asignar-leads" className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"><UserPlus size={12} /> Asignar Leads</a><a href="/estadisticas" className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1"><BarChart3 size={12} /> Estadisticas</a></div>
      </div>
      {loading ? (<PageSkeleton />) : (<>
        {botStatus && (<div className="card bg-gradient-to-r from-blue-50 dark:from-blue-900/10 to-gray-50 dark:to-gray-800 border-blue-200 dark:border-blue-800"><div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold flex items-center gap-2"><Bot size={16} className="text-[#0a6ea9]" /> Estado de la App</h3><a href="/bots" className="text-[10px] text-[#0a6ea9] hover:underline">Control</a></div><div className="grid grid-cols-5 gap-3">{['Workers','Cola pend.','En progreso','Proxies','Maquinas'].map((l,i)=>(<div key={i} className="text-center"><p className={`text-lg font-bold ${i===0?botStatus.workers>0?'text-emerald-600':'text-gray-400':i===1?'text-amber-600':i===2?'text-blue-600':i===3?'text-purple-600':botStatus.workers>0?'text-emerald-600':'text-red-500'}`}>{[botStatus.workers,botStatus.colaPendiente,botStatus.colaProgreso,botStatus.proxysActivos,botStatus.maquina][i]}</p><p className="text-[9px] text-gray-500 dark:text-gray-400">{l}</p></div>))}</div></div>)}
        <div className="grid grid-cols-5 gap-4 animate-stagger">
          <FlipCard back="Total de DNIs procesados por el bot desde Pangea Orange. Clientes + No clientes."><KPI icon={Users} label="Total DNIs" value={stats?.totalClientes || 0} color="text-[#481163]" /></FlipCard>
          <FlipCard back="Ventas cerradas en el pipeline. Mide el resultado final del equipo comercial."><KPI icon={BarChart3} label="Ventas" value={totalVentas} color="text-emerald-600" /></FlipCard>
          <FlipCard back="% de leads con datos completos. >80% = base sana. <60% = necesita reanalisis."><KPI icon={Shield} label="Salud Base" value={`${saludBase?.porcentaje ?? '...'}%`} color={!saludBase?'text-gray-400':saludBase.porcentaje>=80?'text-emerald-600':saludBase.porcentaje>=60?'text-amber-600':'text-red-500'} /></FlipCard>
          <FlipCard back="Tasa de conversion: Ventas / Leads asignados. Efectividad global del equipo."><KPI icon={Activity} label="Tasa conversion" value={`${stats ? Math.round(((stats.ventas||0) / Math.max(stats.asignados||1,1)) * 100) : 0}%`} color="text-purple-600" /></FlipCard>
        </div>
        <PausasHoyJefe />
        <div className="card"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Layers size={16} className="text-[#0a6ea9]" /> Pipeline Funnel</h3><div className="space-y-2">{funnel.map(f=>(<div key={f.etapa} className="flex items-center gap-3"><span className="text-[10px] text-gray-500 dark:text-gray-400 w-24 text-right">{f.etapa}</span><div className="flex-1 h-6 bg-gray-50 rounded-full overflow-hidden"><div className={`h-full ${f.color} rounded-full flex items-center justify-end px-2 transition-all`} style={{width:`${Math.max((f.count/maxFunnel)*100,f.count>0?3:0)}%`}}>{f.count>0&&<span className="text-white text-[9px] font-bold">{f.count}</span>}</div></div></div>))}</div></div>
        {/* Forecast + Scoring */}
        <div className="grid grid-cols-2 gap-6">
          {forecast && (
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-[#481163]" /> Forecast de ventas</h3>
              <div className="space-y-1.5 mb-2">
                {[...forecast.historico.slice(-4), ...forecast.prediccion].map((d: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 dark:text-gray-400 w-16 text-right">
                      {new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
                    </span>
                    <div className="flex-1 h-5 flex items-center">
                      <div className={`h-3 rounded ${d.tipo === 'forecast' ? 'bg-[#481163]/20 border border-dashed border-[#481163]/40' : 'bg-[#481163]'}`}
                        style={{ width: `${Math.max((d.ventas / Math.max(...[...forecast.historico, ...forecast.prediccion].map((x:any) => x.ventas || 1))) * 100, d.ventas > 0 ? 3 : 0)}%`, minWidth: d.ventas > 0 ? '8px' : 0 }} />
                      {d.tipo === 'forecast' && d.intervalo_sup !== d.intervalo_inf && (
                        <div className="h-1 bg-[#481163]/10 rounded ml-0.5" style={{ width: `${Math.max(((d.intervalo_sup - d.ventas) / Math.max(...[...forecast.historico, ...forecast.prediccion].map((x:any) => x.ventas || 1))) * 100, 0)}%` }} />
                      )}
                    </div>
                    <span className="text-[9px] font-mono w-6 text-right">{d.ventas}</span>
                    {d.tipo === 'forecast' && <span className="text-[8px] text-gray-400 dark:text-gray-500">est.</span>}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <span className="text-[10px] text-gray-500 dark:text-gray-400">Prox. {forecast.resumen.dias_forecast} dias</span>
                <span className="text-sm font-bold text-[#481163]">~{forecast.resumen.total_forecast} ventas</span>
              </div>
            </div>
          )}
          {scoringResumen && (
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Zap size={16} className="text-amber-500" /> Scoring de leads</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span>Evaluados</span><span className="font-bold">{scoringResumen.total_evaluados}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Top (A+ / A)</span>
                  <span className="font-bold text-emerald-600">{scoringResumen.top_leads}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Calientes (A+..B)</span>
                  <span className="font-bold text-blue-600">{scoringResumen.calientes}</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" /> Frios (D / E)</span>
                  <span className="font-bold text-gray-500">{scoringResumen.frios}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-1">
                  {scoringResumen.top_leads > 0 && <span className="inline-block h-full bg-emerald-500" style={{ width: `${(scoringResumen.top_leads / scoringResumen.total_evaluados) * 100}%` }} />}
                  {scoringResumen.calientes > 0 && <span className="inline-block h-full bg-blue-400" style={{ width: `${((scoringResumen.calientes - scoringResumen.top_leads) / scoringResumen.total_evaluados) * 100}%` }} />}
                </div>
                <div className="text-[9px] text-gray-400 dark:text-gray-500 mt-1">Media: {scoringResumen.puntuacion_media}/100</div>
              </div>
            </div>
          )}
        </div>
        {equipos.length>0&&(<div className="card !p-0 overflow-hidden"><div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700"><h3 className="text-sm font-semibold flex items-center gap-2"><Globe size={16} className="text-[#0a6ea9]" /> Comparativa por equipo</h3></div><table className="w-full"><thead><tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"><th className="table-header px-4 py-2 text-left">Equipo</th><th className="table-header px-4 py-2 text-center">Asesores</th><th className="table-header px-4 py-2 text-center">Pendientes</th><th className="table-header px-4 py-2 text-center">Contactados</th><th className="table-header px-4 py-2 text-center">Ventas</th><th className="table-header px-4 py-2 text-center">Efectividad</th><th className="table-header px-4 py-2 text-center">QA</th><th className="table-header px-4 py-2">Progreso</th></tr></thead><tbody>{eqPaged.map(eq=>(<tr key={eq.equipo} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-800 text-xs"><td className="py-2.5 px-4 font-medium">{eq.equipo}</td><td className="py-2.5 px-4 text-center">{eq.asesores}</td><td className="py-2.5 px-4 text-center font-bold">{eq.pendientes}</td><td className="py-2.5 px-4 text-center">{eq.contactados}</td><td className="py-2.5 px-4 text-center font-bold text-emerald-600">{eq.ventas}</td><td className="py-2.5 px-4 text-center"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${eq.efectividad>=20?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{eq.efectividad}%</span></td><td className="py-2.5 px-4 text-center"><span className={`text-[10px] font-medium ${eq.qaPromedio!=='--'?'text-amber-600':'text-gray-400 dark:text-gray-500'}`}>{eq.qaPromedio}</span></td><td className="py-2.5 px-4"><div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#481163] rounded-full" style={{width:`${Math.min(eq.efectividad,100)}%`}}/></div></div></td></tr>))}</tbody></table>{eqTotal>1&&(<div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700"><div className="flex items-center gap-2"><span className="text-xs text-gray-500 dark:text-gray-400">Mostrar</span><select value={pageSize} onChange={e=>{setPageSize(+e.target.value);setPage(1);}} className="border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-xs bg-white">{PAGE_SIZES.map(s=><option key={s} value={s}>{s}</option>)}</select><span className="text-xs text-gray-500 dark:text-gray-400">de {equipos.length}</span></div><div className="flex items-center gap-1"><button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="btn-outline text-xs px-3 py-1 disabled:opacity-30">Anterior</button><span className="text-xs text-gray-500 dark:text-gray-400 px-2">{page}/{eqTotal}</span><button onClick={()=>setPage(p=>Math.min(eqTotal,p+1))} disabled={page===eqTotal} className="btn-outline text-xs px-3 py-1 disabled:opacity-30">Siguiente</button></div></div>)}</div>)}
        <div><h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Bot size={14} /> App - Extraccion</h3><div className="grid grid-cols-4 gap-3"><KPI icon={Users} label="Total DNIs" value={stats?.totalClientes||0} color="text-[#481163]"/><KPI icon={CheckCircle2} label="Completados" value={stats?.completados||0} color="text-emerald-500"/><KPI icon={AlertTriangle} label="Errores" value={stats?.errores||0} color="text-red-500"/><KPI icon={TrendingUp} label="Completados hoy" value={stats?.completadosHoy||0} color="text-indigo-500"/></div></div>
        <div className="grid grid-cols-4 gap-3">
          <a href="/asignar-leads" className="card bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-3"><UserPlus size={24} className="text-[#0a6ea9]"/><div><p className="text-sm font-semibold">Asignar Leads</p><p className="text-[10px] text-gray-500 dark:text-gray-400">{stats?.sinAsignar||0} sin asignar</p></div><ArrowRight size={16} className="text-gray-400 dark:text-gray-500 ml-auto"/></a>
          <a href="/estadisticas" className="card bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-3"><BarChart3 size={24} className="text-[#0a6ea9]"/><div><p className="text-sm font-semibold">Estadisticas</p><p className="text-[10px] text-gray-500 dark:text-gray-400">KPIs y graficos</p></div><ArrowRight size={16} className="text-gray-400 dark:text-gray-500 ml-auto"/></a>
          <a href="/auditoria" className="card bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-3"><Eye size={24} className="text-[#0a6ea9]"/><div><p className="text-sm font-semibold">Auditoria</p><p className="text-[10px] text-gray-500 dark:text-gray-400">Registro de actividad</p></div><ArrowRight size={16} className="text-gray-400 dark:text-gray-500 ml-auto"/></a>
          <button onClick={()=>setShowParams(!showParams)} className={`card border transition-colors flex items-center gap-3 ${showParams?'bg-[#0a6ea9] border-[#0a6ea9]':'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/20'}`}><Target size={24} className={showParams?'text-white':'text-[#0a6ea9]'}/><div><p className={`text-sm font-semibold ${showParams?'text-white':''}`}>Parametros</p><p className={`text-[10px] ${showParams?'text-white/70':'text-gray-500 dark:text-gray-400'}`}>Metas y reglas</p></div><ArrowRight size={16} className={showParams?'text-white/50':'text-gray-400 dark:text-gray-500 ml-auto'}/></button>
        </div>
        {showParams&&(<div className="card border-[#0a6ea9] border-2"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Target size={16} className="text-[#0a6ea9]"/> Parametros operativos</h3><p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Configura metas y reglas que aplican a todo el call center.</p>{paramsLoading?<Loader2 size={20} className="animate-spin mx-auto"/>:<div className="grid grid-cols-3 gap-4 mb-4">{[{k:'meta_ventas_mes',l:'Meta ventas / asesor / mes'},{k:'meta_contactos_mes',l:'Meta contactos / asesor / mes'},{k:'cooldown_horas',l:'Cooldown (horas)'},{k:'max_intentos',l:'Max intentos por lead'},{k:'dias_liberacion',l:'Dias para liberar leads'},{k:'ingreso_estimado_venta',l:'Ingreso estimado / venta (EUR)'}].map(f=>(<div key={f.k}><label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 block mb-1">{f.l}</label><input type="number" value={params[f.k]||''} onChange={e=>setParams({...params,[f.k]:e.target.value})} className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white"/></div>))}</div>}<div className="flex items-center gap-3"><button onClick={saveParams} disabled={savingParams||paramsLoading} className="btn-primary text-xs px-4 py-1.5 disabled:opacity-40">Guardar parametros</button>{paramMsg&&<span className="text-xs text-emerald-600">{paramMsg}</span>}</div><p className="text-[9px] text-gray-400 dark:text-gray-500 mt-3">Guardados en base de datos. Aplican a todo el sistema.</p></div>)}
      </>)}
      {/* ── Info ── */}
      <div className="mt-8 card-sm bg-gray-50 dark:bg-gray-800 dark:bg-[#1e1a2a] border-dashed border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a]">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">💡 ¿Cómo funciona?</h3>
        <ul className="space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
          <li>· Vista general de todos los equipos a tu cargo. Monitorea asignación, contacto, ventas y efectividad por equipo.</li>
        </ul>
      </div>
    </div>
  );
}

function PausasHoyJefe() {
  const [data, setData] = useState<{ total: number; tiempoTotal: number; asesores: number } | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/pausas?equipo=1&hoy=1');
        if (!res.ok) return;
        const pausas = await res.json();
        const totalSeg = pausas.reduce((s: number, p: any) => s + (p.duracion_segundos || 0), 0);
        const asesoresUnicos = new Set(pausas.map((p: any) => p.usuario_id)).size;
        setData({ total: pausas.length, tiempoTotal: totalSeg, asesores: asesoresUnicos });
      } catch { /* */ }
    })();
  }, []);

  if (!data) return null;
  const fmt = (s: number) => s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}min` : `${Math.round(s / 3600)}h`;
  return (
    <div className="card bg-amber-50/50 border-amber-200">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Pause size={16} className="text-amber-500" /> Pausas hoy</h3>
        <div className="flex items-center gap-4">
          <div className="text-center"><p className="text-lg font-bold text-amber-700">{data.total}</p><p className="text-[9px] text-gray-500 dark:text-gray-400">pausas</p></div>
          <div className="text-center"><p className="text-lg font-bold text-amber-700">{fmt(data.tiempoTotal)}</p><p className="text-[9px] text-gray-500 dark:text-gray-400">tiempo total</p></div>
          <div className="text-center"><p className="text-lg font-bold text-amber-700">{data.asesores}</p><p className="text-[9px] text-gray-500 dark:text-gray-400">asesores</p></div>
        </div>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, color }: any) {
  return (<div className="card text-center"><Icon size={22} className={`mx-auto mb-1.5 ${color}`}/><p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p><p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</p></div>);
}
