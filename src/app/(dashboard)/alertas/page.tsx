/**
 * app/(dashboard)/alertas/page.tsx — Centro de Alertas del sistema
 */

'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Users, Bot, Phone, Calendar, Wifi, Server, CheckCircle2, XCircle } from 'lucide-react';
import Skeleton, { PageSkeleton } from '@/components/shared/Skeleton';
import { toast } from '@/components/shared/Toast';

type Alerta = { tipo: string; titulo: string; descripcion: string; count: number; color: string; icon: any };

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlertas = async () => {
      try {
        // Obtener datos de múltiples fuentes para generar alertas
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        const userId = session?.user?.id || '0';
        const rol = session?.user?.role || 'supervisor';

        const [notifRes, pipelineRes, maquinasRes] = await Promise.all([
          fetch(`/api/pipeline/notifications?user_id=${userId}&rol=${rol}`),
          fetch('/api/pipeline?limit=5'),
          fetch('/api/maquinas'),
        ]);

        const notif = await notifRes.json();
        const maquinas = await maquinasRes.json();

        const items: Alerta[] = [];

        // Leads sin asignar
        if (notif.sinAsignar > 0) {
          items.push({
            tipo: 'sin_asignar', titulo: 'Leads sin asignar',
            descripcion: `${notif.sinAsignar} leads completados esperando ser distribuidos.`,
            count: notif.sinAsignar, color: 'bg-amber-50 border-amber-300 text-amber-800',
            icon: Users,
          });
        }

        // Leads por vencer
        if (notif.porVencer > 0) {
          items.push({
            tipo: 'por_vencer', titulo: 'Leads por vencer',
            descripcion: `${notif.porVencer} leads con más de 2 días sin contacto.`,
            count: notif.porVencer, color: 'bg-red-50 border-red-300 text-red-800',
            icon: Clock,
          });
        }

        // Leads liberados
        if (notif.liberados > 0) {
          items.push({
            tipo: 'liberados', titulo: 'Leads liberados',
            descripcion: `${notif.liberados} leads liberados hoy por inactividad.`,
            count: notif.liberados, color: 'bg-purple-50 border-purple-300 text-purple-800',
            icon: AlertTriangle,
          });
        }

        // Máquinas offline
        const maqsOffline = Array.isArray(maquinas) ? maquinas.filter((m: any) => m.estado !== 'online') : [];
        if (maqsOffline.length > 0) {
          items.push({
            tipo: 'maquinas', titulo: 'Máquinas sin conexión',
            descripcion: `${maqsOffline.length} máquina(s) sin heartbeat: ${maqsOffline.map((m: any) => m.nombre).join(', ')}.`,
            count: maqsOffline.length, color: 'bg-red-50 border-red-300 text-red-800',
            icon: Server,
          });
        }

        // Sin alertas
        if (items.length === 0) {
          items.push({
            tipo: 'ok', titulo: 'Todo en orden',
            descripcion: 'No hay alertas activas en este momento.',
            count: 0, color: 'bg-emerald-50 border-emerald-300 text-emerald-800',
            icon: CheckCircle2,
          });
        }

        setAlertas(items);
      } catch { toast.error('Error al cargar alertas'); }
      setLoading(false);
    };
    fetchAlertas();
    const interval = setInterval(fetchAlertas, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><AlertTriangle size={22} className="text-[#0a6ea9]" />Alertas</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Centro de notificaciones del sistema</p>
      </div>

      {loading ? (
        <PageSkeleton />
      ) : (
        <div className="space-y-3">
          {alertas.map((a, i) => {
            const Icon = a.icon;
            return (
              <div key={i} className={`card border-l-4 ${a.color} flex items-start gap-4`}>
                <div className={`p-2 rounded-lg ${a.color.split(' ')[0]}`}>
                  <Icon size={22} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{a.titulo}</h3>
                    {a.count > 0 && (
                      <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                        a.tipo === 'ok' ? 'bg-emerald-100 text-emerald-700' :
                        a.tipo === 'sin_asignar' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>{a.count}</span>
                    )}
                  </div>
                  <p className="text-xs mt-1 opacity-80">{a.descripcion}</p>
                  {/* Acciones contextuales */}
                  {a.tipo === 'sin_asignar' && (
                    <a href="/asignar-leads" className="inline-block mt-2 text-[10px] font-medium text-[#0a6ea9] hover:underline">
                      Ir a Asignar Leads →
                    </a>
                  )}
                  {a.tipo === 'maquinas' && (
                    <a href="/infraestructura" className="inline-block mt-2 text-[10px] font-medium text-[#0a6ea9] hover:underline">
                      Ir a Infraestructura →
                    </a>
                  )}
                  {a.tipo === 'por_vencer' && (
                    <a href="/asesor" className="inline-block mt-2 text-[10px] font-medium text-[#0a6ea9] hover:underline">
                      Ir a Dashboard →
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resumen rápido */}
      <div className="card bg-gray-50 dark:bg-gray-800">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Clock size={14} className="text-gray-500 dark:text-gray-400" /> Actualización automática
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Las alertas se actualizan cada 60 segundos. Hacé clic en los enlaces para ir directo a resolver cada alerta.
        </p>
      </div>
      {/* ── Info ── */}
      <div className="mt-8 card-sm bg-gray-50 dark:bg-gray-800 dark:bg-[#1e1a2a] border-dashed border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a]">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">💡 ¿Cómo funciona?</h3>
        <ul className="space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
          <li>· Notificaciones de cambios detectados: nuevos Renove, CIMA, permanencias vencidas. Configura qué alertas recibir.</li>
        </ul>
      </div>
    </div>
  );
}
