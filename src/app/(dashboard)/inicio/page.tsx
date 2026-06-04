/**
 * app/(dashboard)/inicio/page.tsx — Landing post-login con cards de proyectos
 */

'use client';

import { useState, useEffect } from 'react';
import { useProject } from '@/lib/project-context';
import { useRouter } from 'next/navigation';
import { Loader2, TrendingUp, Users, ArrowRight } from 'lucide-react';

type ProyectoCard = { id: number; nombre: string; nombre_visible: string; total: number; pendientes: number; completados: number };

const COLORS: Record<string, { bg: string; border: string; text: string; logo?: string }> = {
  orange: { bg: 'from-orange-500 to-orange-600', border: 'border-orange-300', text: 'text-white', logo: 'https://areaclientes.orange.es/assets/orange/img/Orange_Master_logo.svg' },
  mainjobs: { bg: 'from-blue-600 to-blue-800', border: 'border-blue-300', text: 'text-white', logo: 'https://grupomainjobs.com/images/new_logo.png' },
  impresoras: { bg: 'from-gray-600 to-gray-800', border: 'border-gray-300', text: 'text-white' },
};

export default function InicioPage() {
  const { proyectos, setProyecto } = useProject();
  const router = useRouter();
  const [stats, setStats] = useState<Record<number, ProyectoCard>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const map: Record<number, ProyectoCard> = {};
      await Promise.all(proyectos.map(async (p) => {
        try {
          const res = await fetch(`/api/dashboard/proyecto?proyecto=${p.nombre}`);
          const data = await res.json();
          map[p.id] = { ...p, ...data };
        } catch { /* */ }
      }));
      setStats(map);
      setLoading(false);
    };
    if (proyectos.length > 0) fetchStats();
  }, [proyectos]);

  const entrar = (p: ProyectoCard) => {
    const proy = proyectos.find(x => x.id === p.id);
    if (proy) {
      setProyecto(proy);
      router.push('/jefe');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-[#0a6ea9]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#1a1030]">Bienvenido a Oratioo CX</h1>
        <p className="text-sm text-[#7c757c] mt-2">Seleccioná un proyecto para empezar</p>
      </div>

      <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto">
        {proyectos.filter(p => p.activo).map(p => {
          const s = stats[p.id] || { total: 0, pendientes: 0, completados: 0 };
          const color = COLORS[p.nombre] || COLORS.impresoras;

          return (
            <button
              key={p.id}
              onClick={() => entrar({ ...p, ...s })}
              className={`relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-gradient-to-br ${color.bg} ${color.text} p-6 text-left group cursor-pointer`}
            >
              {/* Logo */}
              {color.logo && (
                <div className="mb-4 h-8 flex items-center">
                  <img src={color.logo} alt={p.nombre_visible}
                    className="max-h-8 max-w-[120px] object-contain brightness-0 invert" />
                </div>
              )}

              {/* Stats */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="opacity-70">DNIs cargados</span>
                  <span className="font-bold">{s.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="opacity-70">Completados</span>
                  <span className="font-bold">{s.completados}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="opacity-70">Pendientes</span>
                  <span className="font-bold">{s.pendientes}</span>
                </div>
              </div>

              {/* Progress bar */}
              {s.total > 0 && (
                <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-white/60 rounded-full transition-all"
                    style={{ width: `${Math.round((s.completados / Math.max(s.total, 1)) * 100)}%` }} />
                </div>
              )}

              {/* CTA */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{p.nombre_visible}</span>
                <ArrowRight size={18} className="opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
