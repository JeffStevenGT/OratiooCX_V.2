/**
 * app/inicio/page.tsx — Splash screen post-login
 * Fuera del grupo (dashboard) — sin sidebar, pantalla completa
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight } from 'lucide-react';
import { useProject } from '@/lib/project-context';
import OratiooLogo from '@/components/shared/OratiooLogo';

type ProyectoCard = { id: number; nombre: string; nombre_visible: string };

const PROYECTO_LOGOS: Record<string, string> = {
  orange: 'https://areaclientes.orange.es/assets/orange/img/Orange_Master_logo.svg',
  mainjobs: 'https://grupomainjobs.com/images/new_logo.png',
};

export default function InicioPage() {
  const { proyectos, setProyecto } = useProject();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (proyectos.length > 0) {
      const t = setTimeout(() => setReady(true), 400);
      return () => clearTimeout(t);
    }
  }, [proyectos]);

  const entrar = (p: ProyectoCard) => {
    const proy = proyectos.find(x => x.id === p.id);
    if (proy) {
      setProyecto(proy);
      router.push('/jefe');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#481163] to-[#2d0a40] p-8">
      {/* Logo Oratioo */}
      <div className={`transition-all duration-700 ${ready ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <OratiooLogo className="w-36 h-10 mx-auto mb-6" color="white" />
        <p className="text-sm text-white/50 text-center mb-12">Seleccioná un proyecto</p>
      </div>

      {/* Cards de proyectos */}
      <div className={`flex gap-6 transition-all duration-700 delay-200 ${ready ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {proyectos.filter(p => p.activo).length === 0 ? (
          <Loader2 size={24} className="animate-spin text-white/50" />
        ) : (
          proyectos.filter(p => p.activo).map((p, i) => {
            const logo = PROYECTO_LOGOS[p.nombre];
            return (
              <button
                key={p.id}
                onClick={() => entrar(p)}
                className="group relative w-56 h-56 rounded-2xl bg-white/10 backdrop-blur border border-white/10 hover:bg-white/20 hover:border-white/30 transition-all hover:-translate-y-1 hover:shadow-2xl flex flex-col items-center justify-center gap-4 p-6"
              >
                {logo && (
                  <img src={logo} alt={p.nombre_visible}
                    className="max-h-10 max-w-[140px] object-contain brightness-0 invert opacity-80 group-hover:opacity-100 transition-opacity" />
                )}
                {!logo && (
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-white/60 text-xl font-bold">{p.nombre_visible[0]}</span>
                  </div>
                )}
                <span className="text-white/70 text-sm font-medium group-hover:text-white transition-colors">
                  {p.nombre_visible}
                </span>
                <ArrowRight size={16} className="text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all absolute bottom-4 right-4" />
              </button>
            );
          })
        )}
      </div>

      <p className="text-white/20 text-xs mt-12">Oratioo CX v3.0 · submaster</p>
    </div>
  );
}
