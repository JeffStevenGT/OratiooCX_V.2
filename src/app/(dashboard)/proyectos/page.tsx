/**
 * app/(dashboard)/proyectos/page.tsx — Gestión de Campañas
 */

'use client';

import { useState, useEffect } from 'react';
import { Globe, Play, Pause, Loader2, Users, BarChart3 } from 'lucide-react';

type Proyecto = { id: number; nombre: string; nombre_visible: string; activo: boolean };
type Stats = { proyecto_id: number; total: number; pendientes: number; completados: number };

export default function ProyectosPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [stats, setStats] = useState<Record<number, Stats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pRes, sRes] = await Promise.all([
          fetch('/api/proyectos'),
          fetch('/api/proyectos/stats'),
        ]);
        setProyectos(await pRes.json());
        const sData = await sRes.json();
        const map: Record<number, Stats> = {};
        for (const s of sData) map[s.proyecto_id] = s;
        setStats(map);
      } catch { /* */ }
      setLoading(false);
    };
    fetchData();
  }, []);

  const toggleActivo = async (p: Proyecto) => {
    await fetch('/api/proyectos', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, activo: !p.activo }),
    });
    setProyectos(prev => prev.map(x => x.id === p.id ? { ...x, activo: !x.activo } : x));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-[#1a1030]">Proyectos</h1>
        <p className="text-sm text-[#7c757c] mt-0.5">Gestión de campañas activas</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-[#0a6ea9]" /></div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {proyectos.map(p => {
            const st = stats[p.id] || { total: 0, pendientes: 0, completados: 0 };
            return (
              <div key={p.id} className={`card ${p.activo ? '' : 'opacity-50'}`}>
                <div className="flex items-center justify-between mb-4">
                  <Globe size={20} className={p.activo ? 'text-[#481163]' : 'text-gray-400'} />
                  <button onClick={() => toggleActivo(p)}
                    className={`p-1.5 rounded-lg ${p.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.activo ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                </div>
                <h3 className="text-sm font-semibold text-[#1a1030]">{p.nombre_visible}</h3>
                <p className="text-[10px] text-[#7c757c] mb-3">{p.nombre}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-lg font-bold">{st.total}</p><p className="text-[9px] text-[#7c757c]">Total</p></div>
                  <div><p className="text-lg font-bold text-amber-600">{st.pendientes}</p><p className="text-[9px] text-[#7c757c]">Pend.</p></div>
                  <div><p className="text-lg font-bold text-emerald-600">{st.completados}</p><p className="text-[9px] text-[#7c757c]">Comp.</p></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
