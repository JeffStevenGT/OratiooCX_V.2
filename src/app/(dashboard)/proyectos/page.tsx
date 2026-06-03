/**
 * app/(dashboard)/proyectos/page.tsx — Gestión de Campañas
 */

'use client';

import { useState, useEffect } from 'react';
import { Globe, Play, Pause, Loader2, Users, BarChart3, Plus } from 'lucide-react';

type Proyecto = { id: number; nombre: string; nombre_visible: string; activo: boolean };
type Stats = { proyecto_id: number; total: number; pendientes: number; completados: number };

export default function ProyectosPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [stats, setStats] = useState<Record<number, Stats>>({});
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ nombre: '', nombre_visible: '' });

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

  const crearProyecto = async () => {
    if (!newForm.nombre || !newForm.nombre_visible) return;
    await fetch('/api/proyectos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newForm),
    });
    setNewForm({ nombre: '', nombre_visible: '' });
    setShowNew(false);
    // Refrescar
    const [pRes, sRes] = await Promise.all([fetch('/api/proyectos'), fetch('/api/proyectos/stats')]);
    setProyectos(await pRes.json());
    const sData = await sRes.json();
    const map: Record<number, Stats> = {};
    for (const s of sData) map[s.proyecto_id] = s;
    setStats(map);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-[#1a1030]">Proyectos</h1>
        <p className="text-sm text-[#7c757c] mt-0.5">Gestión de campañas activas</p>
        <button onClick={() => setShowNew(!showNew)}
          className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1">
          <Plus size={12} /> Nuevo Proyecto
        </button>
      </div>

      {showNew && (
        <div className="card-sm bg-[#f8f7fa] flex items-center gap-3">
          <input placeholder="Slug (ej: seguros)" value={newForm.nombre} onChange={e => setNewForm({ ...newForm, nombre: e.target.value })}
            className="border border-[#e0e0f0] rounded-lg px-3 py-1.5 text-xs bg-white" />
          <input placeholder="Nombre visible (ej: Seguros Vida)" value={newForm.nombre_visible} onChange={e => setNewForm({ ...newForm, nombre_visible: e.target.value })}
            className="border border-[#e0e0f0] rounded-lg px-3 py-1.5 text-xs bg-white flex-1" />
          <button onClick={crearProyecto} className="btn-primary text-xs px-3 py-1.5">Crear</button>
          <button onClick={() => setShowNew(false)} className="text-xs text-[#7c757c]">Cancelar</button>
        </div>
      )}

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
