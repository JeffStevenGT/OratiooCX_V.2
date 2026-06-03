/**
 * app/(dashboard)/admin/page.tsx — Dashboard Admin + Auditoría
 */

'use client';

import { useState, useEffect } from 'react';
import { Shield, Loader2, Users, Bot, Wifi, Activity, Server, AlertTriangle, User, Phone, RotateCcw } from 'lucide-react';

const TIPOS = [
  { key: '', label: 'Todos' },
  { key: 'extraccion', label: 'Extracciones', icon: Bot },
  { key: 'llamada', label: 'Llamadas', icon: Phone },
  { key: 'asignacion', label: 'Asignaciones', icon: User },
  { key: 'liberacion', label: 'Liberaciones', icon: RotateCcw },
  { key: 'tipificacion', label: 'Tipificaciones', icon: AlertTriangle },
];

type Stats = { totalClientes: number; pendientes: number; completados: number; errores: number; maquinasOnline: number; workersActivos: number };
type Evento = { id: number; id_cliente: string; dni: string; nombre_cliente: string; tipo: string; descripcion: string; asesor_nombre: string | null; created_at: string };

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [tipo, setTipo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [sRes, eRes] = await Promise.all([
          fetch('/api/admin/stats'),
          fetch(`/api/auditoria${tipo ? `?tipo=${tipo}` : ''}`),
        ]);
        setStats(await sRes.json());
        setEventos(await eRes.json());
      } catch { /* */ }
      setLoading(false);
    };
    fetchData();
  }, [tipo]);

  const tipoBadge = (t: string) => {
    const map: Record<string, string> = {
      extraccion: 'bg-purple-100 text-purple-700', llamada: 'bg-blue-100 text-blue-700',
      asignacion: 'bg-emerald-100 text-emerald-700', liberacion: 'bg-red-100 text-red-700',
      tipificacion: 'bg-amber-100 text-amber-700',
    };
    return map[t] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#1a1030]">Dashboard Admin</h1>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <MiniKPI icon={Users} label="Clientes" value={stats?.totalClientes || 0} color="text-[#481163]" />
        <MiniKPI icon={Bot} label="Pendientes" value={stats?.pendientes || 0} color="text-amber-500" />
        <MiniKPI icon={Activity} label="Completados" value={stats?.completados || 0} color="text-emerald-500" />
        <MiniKPI icon={AlertTriangle} label="Errores" value={stats?.errores || 0} color="text-red-500" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <MiniKPI icon={Server} label="Máquinas online" value={stats?.maquinasOnline || 0} color="text-blue-500" />
        <MiniKPI icon={Activity} label="Workers activos" value={stats?.workersActivos || 0} color="text-emerald-500" />
        <MiniKPI icon={Users} label="Tasa completados" value={`${stats ? Math.round((stats.completados / Math.max(stats.totalClientes || 1, 1)) * 100) : 0}%`} color="text-purple-500" />
      </div>

      {/* Auditoría */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Shield size={16} className="text-[#0a6ea9]" /> Auditoría</h3>
        <div className="flex gap-2 mb-4 flex-wrap">
          {TIPOS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTipo(t.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border ${
                  tipo === t.key ? 'bg-[#0a6ea9] text-white border-[#0a6ea9]' : 'bg-white text-[#7c757c] border-[#e0e0f0]'
                }`}>{Icon && <Icon size={11} />} {t.label}</button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#b8b0b8]" /></div>
        ) : (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b">
                  <th className="py-1.5 px-2 text-left text-[#7c757c]">Fecha</th>
                  <th className="py-1.5 px-2 text-left text-[#7c757c]">Tipo</th>
                  <th className="py-1.5 px-2 text-left text-[#7c757c]">DNI</th>
                  <th className="py-1.5 px-2 text-left text-[#7c757c]">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {eventos.slice(0, 50).map(e => (
                  <tr key={e.id} className="border-b border-[#f0f0f8]">
                    <td className="py-1 px-2 whitespace-nowrap">{e.created_at ? new Date(e.created_at).toLocaleString('es-PE') : '—'}</td>
                    <td className="py-1 px-2"><span className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${tipoBadge(e.tipo)}`}>{e.tipo}</span></td>
                    <td className="py-1 px-2 font-mono">{e.dni}</td>
                    <td className="py-1 px-2 max-w-[400px] truncate">{e.descripcion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniKPI({ icon: Icon, label, value, color }: any) {
  return (
    <div className="card text-center">
      <Icon size={20} className={`mx-auto mb-1 ${color}`} />
      <p className="text-xl font-bold text-[#1a1030]">{value}</p>
      <p className="text-[10px] text-[#7c757c]">{label}</p>
    </div>
  );
}
