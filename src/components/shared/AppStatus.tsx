/**
 * components/shared/AppStatus.tsx — Widget de estado del bot en sidebar
 */

'use client';

import { useState, useEffect } from 'react';
import { Activity, Server } from 'lucide-react';

type BotStats = {
  online: boolean;
  maquinasOnline: number;
  totalWorkers: number;
  procesadosHoy: number;
  pendientes: number;
  velocidad: number;
  etaHoras: number;
};

export default function AppStatus() {
  const [stats, setStats] = useState<BotStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/bot/stats');
        if (res.ok) setStats(await res.json());
      } catch { /* ignore */ }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // cada 30s
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  const etaText = stats.etaHoras > 0
    ? stats.etaHoras < 1 ? '< 1h' : `~${stats.etaHoras}h`
    : '—';

  return (
    <div className="px-3 py-2 border-t border-[#e8dce6] dark:border-gray-700">
      {/* Cabecera */}
      <div className="flex items-center gap-2 mb-2">
        <Server size={13} className={stats.online ? 'text-emerald-500' : 'text-gray-400'} />
        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
          {stats.online ? 'Apps activas' : 'Apps offline'}
        </span>
        <span className={`ml-auto w-2 h-2 rounded-full ${stats.online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
        <div className="text-gray-400">Hoy</div>
        <div className="text-right font-mono font-medium text-gray-700 dark:text-gray-200">
          {stats.procesadosHoy.toLocaleString()}
        </div>
        <div className="text-gray-400">Velocidad</div>
        <div className="text-right font-mono font-medium text-gray-700 dark:text-gray-200">
          {stats.velocidad}/min
        </div>
        <div className="text-gray-400">Pendientes</div>
        <div className="text-right font-mono font-medium text-amber-600">
          {stats.pendientes.toLocaleString()}
        </div>
        <div className="text-gray-400">ETA</div>
        <div className="text-right font-mono font-medium text-gray-700 dark:text-gray-200">
          {etaText}
        </div>
      </div>

      {/* Workers */}
      <div className="flex items-center gap-1 mt-1.5 text-[9px] text-gray-400">
        <Activity size={10} />
        {stats.totalWorkers} workers · {stats.maquinasOnline} máquinas
      </div>
    </div>
  );
}
