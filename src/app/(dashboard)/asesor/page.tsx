/**
 * app/(dashboard)/asesor/page.tsx — Dashboard Asesor
 */

'use client';

import { useState, useEffect } from 'react';
import { Phone, Target, Clock, AlertTriangle, TrendingUp, Users } from 'lucide-react';

type Stats = {
  totalPendientes: number; nuevos: number; porVencer: number;
  totalContactados: number; liberados: number;
};

export default function AsesorDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Obtener userId de la sesión vía API de auth
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        const userId = session?.user?.id;
        const rol = session?.user?.role || 'asesor';

        if (userId) {
          const res = await fetch(`/api/pipeline/notifications?user_id=${userId}&rol=${rol}`);
          setStats(await res.json());
        }
      } catch { /* */ }
      setLoading(false);
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-[#1a1030]">Dashboard</h1>
        <p className="text-sm text-[#7c757c] mt-0.5">Tu panel de trabajo</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card icon={Target} label="Leads Pendientes" value={stats?.totalPendientes || 0}
          color="bg-blue-50 text-blue-700" loading={loading} />
        <Card icon={Clock} label="Nuevos (24h)" value={stats?.nuevos || 0}
          color="bg-emerald-50 text-emerald-700" loading={loading} />
        <Card icon={AlertTriangle} label="Por Vencer" value={stats?.porVencer || 0}
          color={stats?.porVencer ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'} loading={loading} />
        <Card icon={Phone} label="Contactados Hoy" value={stats?.totalContactados || 0}
          color="bg-purple-50 text-purple-700" loading={loading} />
      </div>

      {/* Llamado a la acción */}
      <div className="card bg-gradient-to-r from-[#0a6ea9] to-[#085d8f] text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Power Dialer</h3>
            <p className="text-xs opacity-80 mt-1">
              {stats?.totalPendientes
                ? `Tenés ${stats.totalPendientes} leads para llamar. ${stats.porVencer ? `${stats.porVencer} están por vencer.` : ''}`
                : 'No tenés leads asignados. Pedile a tu supervisor que te asigne.'}
            </p>
          </div>
          <a href="/power-dialer"
            className="bg-white text-[#0a6ea9] rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#f0f4ff] transition-colors">
            Ir al Dialer
          </a>
        </div>
      </div>

      {/* Estado general */}
      <div className="card">
        <h3 className="text-sm font-semibold text-[#1a1030] mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-[#0a6ea9]" />
          Resumen del Día
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-[#f8f7fa] rounded-lg p-4">
            <p className="text-xs text-[#7c757c] mb-1">Leads sin tocar</p>
            <p className="text-xl font-bold text-[#1a1030]">{stats?.totalPendientes || 0}</p>
            {stats?.porVencer ? (
              <p className="text-[10px] text-red-500 mt-1">{stats.porVencer} vencerán pronto</p>
            ) : null}
          </div>
          <div className="bg-[#f8f7fa] rounded-lg p-4">
            <p className="text-xs text-[#7c757c] mb-1">Contactados hoy</p>
            <p className="text-xl font-bold text-[#1a1030]">{stats?.totalContactados || 0}</p>
            <p className="text-[10px] text-[#7c757c] mt-1">Seguí así</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value, color, loading }: any) {
  return (
    <div className={`card text-center ${color.replace('text-', 'bg-').replace('bg-emerald-50', 'bg-emerald-50').replace('bg-red-50', 'bg-red-50')}`}>
      <Icon size={24} className={`mx-auto mb-2 ${color.split(' ')[1]}`} />
      {loading ? (
        <div className="w-12 h-6 bg-gray-200 rounded animate-pulse mx-auto" />
      ) : (
        <p className="text-2xl font-bold">{value}</p>
      )}
      <p className="text-[10px] font-medium mt-1 opacity-70">{label}</p>
    </div>
  );
}
