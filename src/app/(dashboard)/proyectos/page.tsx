/**
 * app/(dashboard)/proyectos/page.tsx — Gestión de Proyectos/Campañas
 */

'use client';

import { useState, useEffect } from 'react';
import { Globe, Plus, CheckCircle2 } from 'lucide-react';

export default function ProyectosPage() {
  const [proyectos, setProyectos] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/proyectos').then(r => r.json()).then(setProyectos);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1a1030]">Proyectos</h1>
      </div>

      <div className="grid gap-3">
        {proyectos.map((p: any) => (
          <div key={p.id} className="card-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#f0f0f8] flex items-center justify-center">
                <Globe size={18} className="text-[#481163]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1a1030]">{p.nombre_visible}</p>
                <p className="text-xs text-[#7c757c] font-mono">{p.nombre}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                p.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}>
                <CheckCircle2 size={10} />
                {p.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
