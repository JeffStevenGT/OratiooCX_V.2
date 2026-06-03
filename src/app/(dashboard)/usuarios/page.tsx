/**
 * app/(dashboard)/usuarios/page.tsx — Gestión de Usuarios
 */

'use client';

import { useState, useEffect } from 'react';
import { Shield, Plus, Edit, Trash2, Loader2 } from 'lucide-react';

const roles = ['asesor', 'supervisor', 'jefe_area', 'back_office', 'it', 'desarrollador'];

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/usuarios').then(r => r.json()).then(setUsuarios).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#1a1030]">Usuarios</h1>

      <div className="grid gap-3">
        {usuarios.map((u: any) => (
          <div key={u.id} className="card-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#f0f0f8] flex items-center justify-center text-sm font-medium text-[#481163]">
                {u.nombre?.charAt(0) || '?'}
              </div>
              <div>
                <p className="text-sm font-medium text-[#1a1030]">{u.nombre}</p>
                <p className="text-xs text-[#7c757c]">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                u.rol === 'desarrollador' ? 'bg-purple-100 text-purple-700' :
                u.rol === 'jefe_area' ? 'bg-blue-100 text-blue-700' :
                u.rol === 'supervisor' ? 'bg-emerald-100 text-emerald-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {u.rol}
              </span>
              <span className={`w-2 h-2 rounded-full ${u.activo ? 'bg-emerald-400' : 'bg-red-400'}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
