/**
 * app/(dashboard)/backoffice/page.tsx — Dashboard Backoffice
 */

'use client';

import { useState, useEffect } from 'react';
import { Package, CheckCircle2, Clock, TrendingUp, Loader2 } from 'lucide-react';

export default function BackofficeDashboard() {
  const [ventas, setVentas] = useState(0);
  const [tramitadas, setTramitadas] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/pipeline/backoffice-stats');
        const data = await res.json();
        setVentas(data.pendientes || 0);
        setTramitadas(data.tramitadasHoy || 0);
      } catch { /* */ }
      setLoading(false);
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-[#1a1030]">Dashboard Backoffice</h1>
        <p className="text-sm text-[#7c757c] mt-0.5">Tramitación de ventas</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <Package size={28} className="text-amber-500 mx-auto mb-2" />
          {loading ? <div className="w-10 h-6 bg-gray-200 rounded animate-pulse mx-auto" /> : <p className="text-3xl font-bold text-[#1a1030]">{ventas}</p>}
          <p className="text-xs text-[#7c757c]">Ventas pendientes</p>
        </div>
        <div className="card text-center">
          <CheckCircle2 size={28} className="text-emerald-500 mx-auto mb-2" />
          {loading ? <div className="w-10 h-6 bg-gray-200 rounded animate-pulse mx-auto" /> : <p className="text-3xl font-bold text-[#1a1030]">{tramitadas}</p>}
          <p className="text-xs text-[#7c757c]">Tramitadas hoy</p>
        </div>
        <div className="card text-center">
          <TrendingUp size={28} className="text-blue-500 mx-auto mb-2" />
          <p className="text-3xl font-bold text-[#1a1030]">—</p>
          <p className="text-xs text-[#7c757c]">Tiempo promedio</p>
        </div>
      </div>

      {ventas > 0 && (
        <div className="card bg-amber-50 border-amber-200">
          <p className="text-sm font-medium text-amber-800">
            ⚠️ Hay {ventas} ventas pendientes de tramitación
          </p>
          <a href="/backoffice/tramitacion" className="text-xs text-[#0a6ea9] hover:underline mt-1 inline-block">
            Ir a Tramitación →
          </a>
        </div>
      )}
    </div>
  );
}
