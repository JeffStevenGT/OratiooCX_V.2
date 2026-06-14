/**
 * app/(dashboard)/admin/page.tsx — Dashboard Admin + Auditoría
 */

'use client';

import { useState, useEffect } from 'react';
import { LayoutDashboard, Shield, Loader2, Users, Bot, Wifi, Activity, Server, AlertTriangle, User, Phone, RotateCcw } from 'lucide-react';
import FlipCard from '@/components/shared/FlipCard';

const PAGE_SIZES = [10, 25, 50, 100];

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => { setPage(1); }, [tipo]);

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

  const totalPages = Math.ceil(eventos.length / pageSize);
  const paged = eventos.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#1a1030] flex items-center gap-2"><LayoutDashboard size={22} className="text-[#0a6ea9]" />Dashboard Admin</h1>
          <p className="text-sm text-[#7c757c] mt-0.5">Panel de administración del sistema</p>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <FlipCard back="Total de clientes en la base de datos">
          <MiniKPI icon={Users} label="Clientes" value={stats?.totalClientes || 0} color="text-[#481163]" />
        </FlipCard>
        <FlipCard back="Tareas pendientes de procesar">
          <MiniKPI icon={Bot} label="Pendientes" value={stats?.pendientes || 0} color="text-amber-500" />
        </FlipCard>
        <FlipCard back="Tareas completadas exitosamente">
          <MiniKPI icon={Activity} label="Completados" value={stats?.completados || 0} color="text-emerald-500" />
        </FlipCard>
        <FlipCard back="Errores registrados en procesos">
          <MiniKPI icon={AlertTriangle} label="Errores" value={stats?.errores || 0} color="text-red-500" />
        </FlipCard>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FlipCard back="Máquinas del cluster conectadas">
          <MiniKPI icon={Server} label="Máquinas online" value={stats?.maquinasOnline || 0} color="text-blue-500" />
        </FlipCard>
        <FlipCard back="Workers activos procesando">
          <MiniKPI icon={Activity} label="Workers activos" value={stats?.workersActivos || 0} color="text-emerald-500" />
        </FlipCard>
        <FlipCard back="Porcentaje de tareas completadas">
          <MiniKPI icon={Users} label="Tasa completados" value={`${stats ? Math.round((stats.completados / Math.max(stats.totalClientes || 1, 1)) * 100) : 0}%`} color="text-purple-500" />
        </FlipCard>
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
                {paged.map(e => (
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#7c757c]">Mostrar</span>
              <select value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1); }}
                className="border border-[#e0e0f0] rounded-lg px-2 py-1 text-xs bg-white">
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <span className="text-xs text-[#7c757c]">de {eventos.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="btn-outline text-xs px-3 py-1 disabled:opacity-30">Anterior</button>
              <span className="text-xs text-[#7c757c] px-2">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="btn-outline text-xs px-3 py-1 disabled:opacity-30">Siguiente</button>
            </div>
          </div>
        )}
      </div>
      {/* ── Info ── */}
      <div className="mt-8 card-sm bg-[#f8f7fa] dark:bg-[#1e1a2a] border-dashed border-[#e0e0f0] dark:border-[#2a1f3a]">
        <h3 className="text-xs font-semibold text-[#7c757c] uppercase tracking-wider mb-2">💡 ¿Cómo funciona?</h3>
        <ul className="space-y-1 text-[11px] text-[#7c757c]">
          <li>· Panel de control para administradores. Acceso a estadísticas globales y configuración avanzada.</li>
        </ul>
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
