/**
 * app/(dashboard)/proyectos/page.tsx — Gestión de Campañas
 */

'use client';

import { useState, useEffect } from 'react';
import { Globe, Play, Pause, Loader2, Users, BarChart3, Plus } from 'lucide-react';
import Skeleton from '@/components/shared/Skeleton';
import { toast } from '@/components/shared/Toast';

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
      } catch { toast.error('Error al cargar proyectos'); }
      setLoading(false);
    };
    fetchData();
  }, []);

  const toggleActivo = async (p: Proyecto) => {
    try {
      await fetch('/api/proyectos', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, activo: !p.activo }),
      });
      toast.success(p.activo ? 'Proyecto desactivado' : 'Proyecto activado');
      setProyectos(prev => prev.map(x => x.id === p.id ? { ...x, activo: !x.activo } : x));
    } catch { toast.error('Error al cambiar estado'); }
  };

  const crearProyecto = async () => {
    if (!newForm.nombre || !newForm.nombre_visible) return;
    try {
      await fetch('/api/proyectos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm),
      });
      toast.success('Proyecto creado correctamente');
      setNewForm({ nombre: '', nombre_visible: '' });
      setShowNew(false);
      // Refrescar
      const [pRes, sRes] = await Promise.all([fetch('/api/proyectos'), fetch('/api/proyectos/stats')]);
      setProyectos(await pRes.json());
      const sData = await sRes.json();
      const map: Record<number, Stats> = {};
      for (const s of sData) map[s.proyecto_id] = s;
      setStats(map);
    } catch { toast.error('Error al crear proyecto'); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Globe size={22} className="text-[#0a6ea9]" />Proyectos</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Gestión de campañas activas</p>
        <button onClick={() => setShowNew(!showNew)}
          className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1">
          <Plus size={12} /> Nuevo Proyecto
        </button>
      </div>

      {showNew && (
        <div className="card-sm bg-gray-50 dark:bg-gray-800 flex items-center gap-3">
          <input placeholder="Slug (ej: seguros)" value={newForm.nombre} onChange={e => setNewForm({ ...newForm, nombre: e.target.value })}
            className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs bg-white" />
          <input placeholder="Nombre visible (ej: Seguros Vida)" value={newForm.nombre_visible} onChange={e => setNewForm({ ...newForm, nombre_visible: e.target.value })}
            className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs bg-white flex-1" />
          <button onClick={crearProyecto} className="btn-primary text-xs px-3 py-1.5">Crear</button>
          <button onClick={() => setShowNew(false)} className="text-xs text-gray-500 dark:text-gray-400">Cancelar</button>
        </div>
      )}

      {loading ? (
        <Skeleton variant="card" count={3} />
      ) : proyectos.length === 0 ? (
        <div className="text-center py-16">
          <Globe size={48} className="text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">No hay proyectos</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Crea tu primera campaña para empezar</p>
          <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5 mx-auto">
            <Plus size={12} /> Nuevo Proyecto
          </button>
        </div>
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
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{p.nombre_visible}</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-3">{p.nombre}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-lg font-bold">{st.total}</p><p className="text-[9px] text-gray-500 dark:text-gray-400">Total</p></div>
                  <div><p className="text-lg font-bold text-amber-600">{st.pendientes}</p><p className="text-[9px] text-gray-500 dark:text-gray-400">Pend.</p></div>
                  <div><p className="text-lg font-bold text-emerald-600">{st.completados}</p><p className="text-[9px] text-gray-500 dark:text-gray-400">Comp.</p></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* ── Info ── */}
      <div className="mt-8 card-sm bg-gray-50 dark:bg-gray-800 dark:bg-[#1e1a2a] border-dashed border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a]">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">💡 ¿Cómo funciona?</h3>
        <ul className="space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
          <li>· Gestión de proyectos activos. Cada proyecto tiene sus propios clientes, pipeline y configuraciones.</li>
        </ul>
      </div>
    </div>
  );
}
