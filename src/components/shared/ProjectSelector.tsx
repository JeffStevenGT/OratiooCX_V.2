/**
 * components/shared/ProjectSelector.tsx — Selector de proyecto
 */

'use client';

import { useProject } from '@/lib/project-context';
import { Globe, ChevronDown } from 'lucide-react';

export default function ProjectSelector() {
  const { proyecto, setProyecto, proyectos } = useProject();

  return (
    <div className="relative">
      <select
        value={proyecto?.id || ''}
        onChange={e => {
          const p = proyectos.find(p => p.id === parseInt(e.target.value));
          if (p) setProyecto(p);
        }}
        className="appearance-none bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 pr-8 text-xs text-white cursor-pointer hover:bg-white/20 transition-colors w-full"
      >
        {proyectos.filter(p => p.activo).map(p => (
          <option key={p.id} value={p.id} className="text-[#1a1030]">{p.nombre_visible}</option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
    </div>
  );
}
