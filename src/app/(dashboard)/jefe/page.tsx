/**
 * app/(dashboard)/jefe/page.tsx — Launchpad ejecutivo
 * Solo KPIs esenciales + accesos directos. Todo lo demás en sus páginas.
 */

'use client';

import { useProject } from '@/lib/project-context';
import { LayoutDashboard, Users, TrendingUp, Shield, Activity, Bot, ArrowRight, BarChart3, UserPlus, Eye, Target } from 'lucide-react';
import FlipCard from '@/components/shared/FlipCard';
import { useAPI, apiUrl } from '@/hooks/useSWR';

export default function JefeDashboard() {
  const { proyecto } = useProject();

  // Solo 3 llamadas: proyecto stats + salud base + maquinas
  const { data: stats } = useAPI<any>(
    proyecto ? apiUrl('/api/dashboard/proyecto', { proyecto: proyecto.nombre }) : null
  );
  const { data: salud } = useAPI<any>(apiUrl('/api/dashboard/salud-base', { dias: '90' }));
  const { data: maquinas } = useAPI<any[]>(apiUrl('/api/maquinas'));

  if (!proyecto) return null;

  const online = Array.isArray(maquinas) ? maquinas.filter((m: any) => m.estado === 'online') : [];
  const workersActivos = online.reduce((s: number, m: any) => s + (m.workers_activos || 0), 0);
  const totalVentas = stats?.ventas || 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <LayoutDashboard size={22} className="text-[#0a6ea9]" />{proyecto.nombre_visible}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Visión ejecutiva</p>
      </div>

      {/* ── Bot status (1 línea) ── */}
      <div className="card-sm flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Bot size={14} className={workersActivos > 0 ? 'text-emerald-500' : 'text-red-400'} />
          <span className="text-xs text-gray-500">Workers:</span>
          <span className={`text-sm font-bold ${workersActivos > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {workersActivos || 0}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Maquinas:</span>
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{online.length || 0} online</span>
        </div>
        <a href="/bots" className="text-[10px] text-[#0a6ea9] hover:underline ml-auto">Control</a>
      </div>

      {/* ── 4 KPIs ── */}
      <div className="grid grid-cols-4 gap-4">
        <FlipCard back="Total de DNIs procesados por el bot desde Pangea">
          <KPI icon={Users} label="Total DNIs" value={stats?.totalClientes || 0} color="text-[#481163]" />
        </FlipCard>
        <FlipCard back="Ventas cerradas en el pipeline">
          <KPI icon={BarChart3} label="Ventas" value={totalVentas} color="text-emerald-600" />
        </FlipCard>
        <FlipCard back="% de leads con datos completos. >80% = base sana">
          <KPI icon={Shield} label="Salud Base" value={`${salud?.porcentaje ?? '...'}%`}
            color={!salud ? 'text-gray-400' : salud.porcentaje >= 80 ? 'text-emerald-600' : salud.porcentaje >= 60 ? 'text-amber-600' : 'text-red-500'} />
        </FlipCard>
        <FlipCard back="Tasa de conversion: Ventas / Leads asignados">
          <KPI icon={Activity} label="Conversion" value={`${stats ? Math.round(((stats.ventas || 0) / Math.max(stats.asignados || 1, 1)) * 100) : 0}%`} color="text-purple-600" />
        </FlipCard>
      </div>

      {/* ── Accesos rápidos ── */}
      <div className="grid grid-cols-3 gap-3">
        <a href="/extracciones"
          className="card bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-3 p-4">
          <BarChart3 size={22} className="text-[#0a6ea9]" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Extracciones</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">Datos del bot · CIMA · Renove</p>
          </div>
          <ArrowRight size={14} className="text-gray-400" />
        </a>
        <a href="/estadisticas"
          className="card bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-3 p-4">
          <BarChart3 size={22} className="text-[#0a6ea9]" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Estadísticas</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">KPIs · Tiempos · Gráficos</p>
          </div>
          <ArrowRight size={14} className="text-gray-400" />
        </a>
        <a href="/rendimiento"
          className="card bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-3 p-4">
          <TrendingUp size={22} className="text-[#0a6ea9]" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Rendimiento</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">Ranking · Cinturones</p>
          </div>
          <ArrowRight size={14} className="text-gray-400" />
        </a>
        <a href="/supervisor"
          className="card bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-3 p-4">
          <Eye size={22} className="text-[#0a6ea9]" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Equipo</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">Asesores · Pausas</p>
          </div>
          <ArrowRight size={14} className="text-gray-400" />
        </a>
        <a href="/asignar-leads"
          className="card bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-3 p-4">
          <UserPlus size={22} className="text-[#0a6ea9]" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Asignar Leads</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">{stats?.sinAsignar || 0} sin asignar</p>
          </div>
          <ArrowRight size={14} className="text-gray-400" />
        </a>
        <a href="/config"
          className="card bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-3 p-4">
          <Target size={22} className="text-[#0a6ea9]" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Parámetros</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">Metas · Reglas</p>
          </div>
          <ArrowRight size={14} className="text-gray-400" />
        </a>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, color }: any) {
  return (
    <div className="card text-center py-4">
      <Icon size={22} className={`mx-auto mb-1.5 ${color}`} />
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
