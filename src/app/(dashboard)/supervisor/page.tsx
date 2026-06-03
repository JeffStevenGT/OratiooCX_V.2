/**
 * app/(dashboard)/supervisor/page.tsx — Dashboard Supervisor
 */

'use client';

import { useState, useEffect } from 'react';
import { Users, Phone, Target, AlertTriangle, TrendingUp, UserCheck } from 'lucide-react';

type AsesorStats = { id: number; nombre: string; equipo: string; pendientes: number; contactados: number; porVencer: number };
type GlobalStats = { sinAsignar: number; liberados: number; totalAsesores: number; totalContactadosHoy: number };

export default function SupervisorDashboard() {
  const [global, setGlobal] = useState<GlobalStats | null>(null);
  const [asesores, setAsesores] = useState<AsesorStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Global stats
        const res = await fetch('/api/pipeline/notifications?user_id=0&rol=supervisor');
        const data = await res.json();

        // Asesores del equipo
        const usuariosRes = await fetch('/api/usuarios?rol=asesor');
        const usuarios = await usuariosRes.json();

        // Stats por asesor
        const asesoresStats = await Promise.all(
          usuarios.map(async (a: any) => {
            const aRes = await fetch(`/api/pipeline/notifications?user_id=${a.id}&rol=asesor`);
            const aData = await aRes.json();
            return {
              id: a.id, nombre: a.nombre, equipo: a.equipo || '—',
              pendientes: aData.totalPendientes || 0,
              contactados: aData.totalContactados || 0,
              porVencer: aData.porVencer || 0,
            };
          })
        );

        setGlobal({
          sinAsignar: data.sinAsignar || 0,
          liberados: data.liberados || 0,
          totalAsesores: usuarios.length,
          totalContactadosHoy: asesoresStats.reduce((sum, a) => sum + a.contactados, 0),
        });
        setAsesores(asesoresStats);
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
        <h1 className="text-xl font-bold text-[#1a1030]">Dashboard Supervisor</h1>
        <p className="text-sm text-[#7c757c] mt-0.5">Visión de tu equipo</p>
      </div>

      {/* Cards globales */}
      <div className="grid grid-cols-4 gap-4">
        <MiniCard icon={Target} label="Sin Asignar" value={global?.sinAsignar || 0} color="text-amber-600" loading={loading} />
        <MiniCard icon={AlertTriangle} label="Liberados Hoy" value={global?.liberados || 0} color="text-red-600" loading={loading} />
        <MiniCard icon={Users} label="Asesores" value={global?.totalAsesores || 0} color="text-blue-600" loading={loading} />
        <MiniCard icon={Phone} label="Contactados Hoy" value={global?.totalContactadosHoy || 0} color="text-emerald-600" loading={loading} />
      </div>

      {/* Tabla de asesores */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e8dce6]">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <UserCheck size={16} className="text-[#0a6ea9]" /> Rendimiento del equipo
          </h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="animate-spin w-5 h-5 border-2 border-[#0a6ea9] border-t-transparent rounded-full" /></div>
        ) : asesores.length === 0 ? (
          <div className="text-center py-12"><Users size={40} className="text-[#b8b0b8] mx-auto mb-2" /><p className="text-sm text-[#7c757c]">Sin asesores en tu equipo</p></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e8dce6] bg-[#f8f7fa]">
                <th className="table-header px-4 py-2.5 text-left">Asesor</th>
                <th className="table-header px-4 py-2.5 text-left">Equipo</th>
                <th className="table-header px-4 py-2.5 text-center">Pendientes</th>
                <th className="table-header px-4 py-2.5 text-center">Contactados</th>
                <th className="table-header px-4 py-2.5 text-center">Por Vencer</th>
                <th className="table-header px-4 py-2.5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {asesores.map(a => (
                <tr key={a.id} className="border-b border-[#f0f0f8] hover:bg-[#f8f7fa]">
                  <td className="py-2.5 px-4 text-xs font-medium">{a.nombre}</td>
                  <td className="py-2.5 px-4 text-xs">{a.equipo}</td>
                  <td className="py-2.5 px-4 text-xs text-center font-bold">{a.pendientes}</td>
                  <td className="py-2.5 px-4 text-xs text-center">{a.contactados}</td>
                  <td className="py-2.5 px-4 text-xs text-center">
                    <span className={a.porVencer > 0 ? 'text-red-600 font-bold' : 'text-[#7c757c]'}>{a.porVencer}</span>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      a.pendientes === 0 ? 'bg-emerald-100 text-emerald-700' :
                      a.porVencer > 0 ? 'bg-red-100 text-red-700' :
                      a.contactados > 0 ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {a.pendientes === 0 ? 'Al día' : a.porVencer > 0 ? '⚠️ Urgente' : a.contactados > 0 ? 'Activo' : 'Pendiente'}
                    </span>
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

function MiniCard({ icon: Icon, label, value, color, loading }: any) {
  return (
    <div className="card text-center">
      <Icon size={24} className={`mx-auto mb-2 ${color}`} />
      {loading ? <div className="w-10 h-6 bg-gray-200 rounded animate-pulse mx-auto" /> : <p className="text-2xl font-bold text-[#1a1030]">{value}</p>}
      <p className="text-[10px] text-[#7c757c] mt-1">{label}</p>
    </div>
  );
}
