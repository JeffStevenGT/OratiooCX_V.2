/**
 * app/(dashboard)/backoffice/page.tsx — Dashboard Backoffice
 */

'use client';

import { useState, useEffect } from 'react';
import { LayoutDashboard, Package, CheckCircle2, Clock, TrendingUp, Loader2, FileText, Activity, Users } from 'lucide-react';
import FlipCard from '@/components/shared/FlipCard';

type Stats = { pendientes: number; tramitadasHoy: number; activadasHoy: number; totalTramitadas: number; tiempoPromedio: string; asesoresActivos: number };

export default function BackofficeDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/pipeline/backoffice-stats');
        setStats(await res.json());
      } catch { /* */ }
      setLoading(false);
    };
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><LayoutDashboard size={22} className="text-[#0a6ea9]" />Dashboard Backoffice</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Tramitación y activación de ventas</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <FlipCard back="Ventas pendientes de tramitación">
          <KPI icon={Package} label="Pendientes" value={stats?.pendientes || 0} color="text-amber-500" loading={loading} />
        </FlipCard>
        <FlipCard back="Ventas tramitadas en el día">
          <KPI icon={CheckCircle2} label="Tramitadas hoy" value={stats?.tramitadasHoy || 0} color="text-emerald-500" loading={loading} />
        </FlipCard>
        <FlipCard back="Ventas activadas en el día">
          <KPI icon={Activity} label="Activadas hoy" value={stats?.activadasHoy || 0} color="text-blue-500" loading={loading} />
        </FlipCard>
        <FlipCard back="Total histórico de ventas tramitadas">
          <KPI icon={TrendingUp} label="Total tramitadas" value={stats?.totalTramitadas || 0} color="text-purple-500" loading={loading} />
        </FlipCard>
      </div>

      {/* Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Clock size={16} className="text-gray-500 dark:text-gray-400" /> Métricas
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">Tiempo promedio de tramitación</span>
              <span className="text-xs font-semibold">{stats?.tiempoPromedio || '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">Asesores con ventas</span>
              <span className="text-xs font-semibold">{stats?.asesoresActivos || 0}</span>
            </div>
          </div>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileText size={16} className="text-gray-500 dark:text-gray-400" /> Acciones rápidas
          </h3>
          <div className="space-y-2">
            <a href="/backoffice/tramitacion" className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-[#f0edf5] transition-colors">
              <span className="text-xs font-medium">Ventas pendientes</span>
              <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-bold">{stats?.pendientes || 0}</span>
            </a>
            <a href="/clientes" className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-[#f0edf5] transition-colors">
              <span className="text-xs font-medium">Buscar cliente</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">→</span>
            </a>
          </div>
        </div>
      </div>

      {stats && stats.pendientes > 5 && (
        <div className="card bg-amber-50 border-amber-200">
          <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
            <Activity size={16} /> Hay {stats.pendientes} ventas pendientes de tramitación
          </p>
          <a href="/backoffice/tramitacion" className="text-xs text-[#0a6ea9] hover:underline mt-1 inline-block">
            Ir a Tramitación →
          </a>
        </div>
      )}
      {/* ── Info ── */}
      <div className="mt-8 card-sm bg-gray-50 dark:bg-gray-800 dark:bg-[#1e1a2a] border-dashed border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a]">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">💡 ¿Cómo funciona?</h3>
        <ul className="space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
          <li>· Gestión de trámites y documentación post-venta. Procesa activaciones y verificaciones.</li>
        </ul>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, color, loading }: any) {
  return (
    <div className="card text-center">
      <Icon size={24} className={`mx-auto mb-2 ${color}`} />
      {loading ? <div className="w-10 h-6 bg-gray-200 rounded animate-pulse mx-auto" /> : <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>}
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
