/**
 * app/(dashboard)/agenda/page.tsx — Callbacks programados
 */

'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Phone, CheckCircle2, Star, Gift, AlertCircle, ExternalLink } from 'lucide-react';
import Skeleton, { PageSkeleton } from '@/components/shared/Skeleton';
import { toast } from '@/components/shared/Toast';

type Callback = { id: number; id_cliente: string; dni: string; nombre: string; callback_at: string; estado: string; asesor: string; linea: string; cima: string; intentos: number };

export default function AgendaPage() {
  const [hoy, setHoy] = useState<Callback[]>([]);
  const [manana, setManana] = useState<Callback[]>([]);
  const [semana, setSemana] = useState<Callback[]>([]);
  const [vencidos, setVencidos] = useState<Callback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sRes = await fetch('/api/auth/session');
        const session = await sRes.json();
        const userId = session?.user?.id || '';
        const rol = session?.user?.role || 'asesor';
        const res = await fetch(`/api/pipeline/agenda?user_id=${userId}&rol=${rol}`);
        const data = await res.json();
        setHoy(data.hoy || []);
        setManana(data.manana || []);
        setSemana(data.semana || []);
        setVencidos(data.vencidos || []);
      } catch { toast.error('Error al cargar la agenda'); }
      setLoading(false);
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Marcar callback como completado
  const completarCallback = async (pipelineId: number) => {
    try {
      await fetch('/api/pipeline', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pipelineId, estado: 'pendiente' }),
      });
      toast.success('Callback completado');
      // Refrescar
      const sRes = await fetch('/api/auth/session');
      const session = await sRes.json();
      const userId = session?.user?.id || '';
      const rol = session?.user?.role || 'asesor';
      const res = await fetch(`/api/pipeline/agenda?user_id=${userId}&rol=${rol}`);
      const data = await res.json();
      setHoy(data.hoy || []);
      setManana(data.manana || []);
      setSemana(data.semana || []);
      setVencidos(data.vencidos || []);
    } catch {
      toast.error('Error al completar callback');
    }
  };

  if (loading) return <PageSkeleton />;

  const total = hoy.length + manana.length + semana.length + vencidos.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white dark:text-white flex items-center gap-2"><Calendar size={22} className="text-[#0a6ea9]" />Agenda</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{total} callbacks programados</p>
      </div>

      {vencidos.length > 0 && (
        <Section titulo="Vencidos" icon={AlertCircle} color="border-l-red-500 bg-red-50 dark:bg-red-950/20" callbacks={vencidos} urgente onCompletar={completarCallback} />
      )}
      {hoy.length > 0 && (
        <Section titulo="Hoy" icon={Clock} color="border-l-blue-500 bg-blue-50 dark:bg-blue-950/20" callbacks={hoy} onCompletar={completarCallback} />
      )}
      {manana.length > 0 && (
        <Section titulo="Manana" icon={Calendar} color="border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" callbacks={manana} onCompletar={completarCallback} />
      )}
      {semana.length > 0 && (
        <Section titulo="Esta semana" icon={Calendar} color="border-l-purple-500 bg-purple-50 dark:bg-purple-950/20" callbacks={semana} onCompletar={completarCallback} />
      )}

      {total === 0 && (
        <div className="card text-center py-16">
          <Calendar size={48} className="text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">No hay callbacks programados</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Los callbacks aparecerán cuando tipifiques leads para volver a llamar</p>
          <a href="/power-dialer" className="btn-primary inline-flex items-center gap-1.5 text-xs px-4 py-2">
            <Phone size={14} /> Ir al Power Dialer
          </a>
        </div>
      )}
      {/* ── Info ── */}
      <div className="mt-8 card-sm bg-gray-50 dark:bg-gray-800 dark:bg-[#1e1a2a] border-dashed border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a]">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">💡 ¿Cómo funciona?</h3>
        <ul className="space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
          <li>· Calendario de seguimiento de leads. Programa llamadas y revisa tu plan del día.</li>
        </ul>
      </div>
    </div>
  );
}

function Section({ titulo, icon: Icon, color, callbacks, urgente, onCompletar }: any) {
  return (
    <div className={`card border-l-4 ${color}`}>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Icon size={16} className={urgente ? 'text-red-500' : ''} /> {titulo} ({callbacks.length})
      </h3>
      <div className="space-y-2">
        {callbacks.map((c: Callback) => (
          <div key={c.id} className={`flex items-center justify-between p-3 rounded-lg ${urgente ? 'bg-red-100 dark:bg-red-950/30 border border-red-200 dark:border-red-800' : 'bg-white dark:bg-[#1e1e2a] border border-gray-200 dark:border-gray-600 dark:border-[#2a2a3a]'}`}>
            <div className="flex items-center gap-3 min-w-0">
              <Phone size={14} className={urgente ? 'text-red-500 shrink-0' : 'text-gray-500 dark:text-gray-400 shrink-0'} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium truncate">{c.nombre || c.dni}</p>
                  {c.cima === 'SI' && <Star size={10} className="text-emerald-500 shrink-0" />}
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                  {c.dni} · {c.linea || 'sin linea'}
                  {c.intentos > 0 && <span className="ml-1">· {c.intentos} intento{c.intentos > 1 ? 's' : ''}</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <p className={`text-xs font-bold ${urgente ? 'text-red-600' : 'text-gray-900 dark:text-white dark:text-white'}`}>
                  {c.callback_at ? new Date(c.callback_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '--'}
                </p>
                {urgente && <p className="text-[10px] text-red-400">vencido</p>}
              </div>
              <a href={`/power-dialer?lead=${c.id}`}
                className="p-1.5 rounded-lg bg-[#0a6ea9] text-white hover:bg-[#085d8f] transition-colors"
                title="Llamar ahora">
                <Phone size={12} />
              </a>
              <button onClick={() => onCompletar(c.id)}
                className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 hover:bg-emerald-200 transition-colors"
                title="Marcar como completado">
                <CheckCircle2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
