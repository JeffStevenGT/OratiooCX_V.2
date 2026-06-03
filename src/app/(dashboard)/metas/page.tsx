/**
 * app/(dashboard)/metas/page.tsx — Metas del Equipo
 */

'use client';

import { useState, useEffect } from 'react';
import { Target, TrendingUp, Loader2, Award } from 'lucide-react';

type Meta = { id: number; nombre: string; equipo: string; pendientes: number; contactados: number; ventas: number; tasa: number };

export default function MetasPage() {
  const [asesores, setAsesores] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const usuariosRes = await fetch('/api/usuarios?rol=asesor');
        const usuarios = await usuariosRes.json();

        const stats = await Promise.all(usuarios.map(async (a: any) => {
          const r = await fetch(`/api/pipeline/notifications?user_id=${a.id}&rol=asesor`);
          const d = await r.json();
          // Simular ventas (en prod vendrían de pipeline estado=venta)
          const ventas = Math.floor(Math.random() * 3);
          return {
            id: a.id, nombre: a.nombre, equipo: a.equipo || '—',
            pendientes: d.totalPendientes || 0,
            contactados: d.totalContactados || 0,
            ventas,
            tasa: d.totalPendientes > 0 ? Math.round((d.totalContactados / (d.totalPendientes + d.totalContactados || 1)) * 100) : 0,
          };
        }));

        setAsesores(stats.sort((a: Meta, b: Meta) => b.contactados - a.contactados));
      } catch { /* */ }
      setLoading(false);
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-[#1a1030]">Metas</h1>
        <p className="text-sm text-[#7c757c] mt-0.5">Rendimiento del equipo</p>
      </div>

      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-[#0a6ea9]" /></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e8dce6] bg-[#f8f7fa]">
                <th className="table-header px-4 py-2.5 text-left">#</th>
                <th className="table-header px-4 py-2.5 text-left">Asesor</th>
                <th className="table-header px-4 py-2.5 text-left">Equipo</th>
                <th className="table-header px-4 py-2.5 text-center">Pendientes</th>
                <th className="table-header px-4 py-2.5 text-center">Contactados</th>
                <th className="table-header px-4 py-2.5 text-center">Tasa</th>
              </tr>
            </thead>
            <tbody>
              {asesores.map((a, i) => (
                <tr key={a.id} className={`border-b border-[#f0f0f8] hover:bg-[#f8f7fa] ${i < 3 ? 'bg-[#fffdf0]' : ''}`}>
                  <td className="py-2.5 px-4">
                    {i === 0 ? <Award size={16} className="text-amber-500" /> :
                     i === 1 ? <Award size={16} className="text-gray-400" /> :
                     i === 2 ? <Award size={16} className="text-amber-700" /> :
                     <span className="text-xs text-[#7c757c]">{i + 1}</span>}
                  </td>
                  <td className="py-2.5 px-4 text-xs font-medium">{a.nombre}</td>
                  <td className="py-2.5 px-4 text-xs">{a.equipo}</td>
                  <td className="py-2.5 px-4 text-xs text-center">{a.pendientes}</td>
                  <td className="py-2.5 px-4 text-xs text-center font-bold">{a.contactados}</td>
                  <td className="py-2.5 px-4 text-center">
                    <div className="flex items-center gap-1.5 justify-center">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#0a6ea9] rounded-full transition-all" style={{ width: `${Math.min(a.tasa, 100)}%` }} />
                      </div>
                      <span className="text-[10px] font-medium">{a.tasa}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
