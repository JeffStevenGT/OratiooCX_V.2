/**
 * app/(dashboard)/jefe/page.tsx — Dashboard General por proyecto
 */

'use client';

import { useState, useEffect } from 'react';
import { useProject } from '@/lib/project-context';
import { Users, Target, TrendingUp, Globe, BarChart3, Bot, AlertTriangle, Loader2, Phone, Clock, Activity, CheckCircle2 } from 'lucide-react';

type Stats = { totalClientes: number; pendientes: number; completados: number; enProgreso: number; noCliente: number; errores: number; sinAsignar: number; asignados: number; contactados: number; ventas: number; completadosHoy: number };

export default function JefeDashboard() {
  const { proyecto } = useProject();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!proyecto) return;
    setLoading(true);
    fetch(`/api/dashboard/proyecto?proyecto=${proyecto.nombre}`)
      .then(r => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [proyecto]);

  if (!proyecto) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-[#1a1030]">{proyecto.nombre_visible}</h1>
        <p className="text-sm text-[#7c757c] mt-0.5">Dashboard del proyecto</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-[#0a6ea9]" /></div>
      ) : (
        <>
          {/* App (ex-Bot) */}
          <div>
            <h3 className="text-xs font-semibold text-[#7c757c] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Bot size={14} /> App — Extracción
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <KPI icon={Users} label="Total DNIs" value={stats?.totalClientes || 0} color="text-[#481163]" />
              <KPI icon={Clock} label="Pendientes" value={stats?.pendientes || 0} color="text-amber-500" />
              <KPI icon={Activity} label="En progreso" value={stats?.enProgreso || 0} color="text-blue-500" />
              <KPI icon={CheckCircle2} label="Completados" value={stats?.completados || 0} color="text-emerald-500" />
            </div>
            <div className="grid grid-cols-4 gap-3 mt-3">
              <KPI icon={AlertTriangle} label="Errores" value={stats?.errores || 0} color="text-red-500" />
              <KPI icon={Users} label="No cliente" value={stats?.noCliente || 0} color="text-gray-500" />
              <KPI icon={TrendingUp} label="Hoy" value={stats?.completadosHoy || 0} color="text-indigo-500" />
              <KPI icon={BarChart3} label="Tasa éxito" value={`${stats ? Math.round((stats.completados / Math.max(stats.totalClientes || 1, 1)) * 100) : 0}%`} color="text-purple-500" />
            </div>
          </div>

          {/* Comercial */}
          <div>
            <h3 className="text-xs font-semibold text-[#7c757c] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Phone size={14} /> Comercial
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <KPI icon={Target} label="Sin asignar" value={stats?.sinAsignar || 0} color="text-orange-500" />
              <KPI icon={Users} label="Asignados" value={stats?.asignados || 0} color="text-blue-500" />
              <KPI icon={Phone} label="Contactados" value={stats?.contactados || 0} color="text-emerald-500" />
              <KPI icon={BarChart3} label="Ventas" value={stats?.ventas || 0} color="text-[#481163]" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KPI({ icon: Icon, label, value, color }: any) {
  return (
    <div className="card text-center">
      <Icon size={22} className={`mx-auto mb-1.5 ${color}`} />
      <p className="text-xl font-bold text-[#1a1030]">{value}</p>
      <p className="text-[10px] text-[#7c757c] mt-0.5">{label}</p>
    </div>
  );
}
