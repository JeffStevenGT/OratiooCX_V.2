/**
 * components/shared/MiEstado.tsx — Widget de estado del asesor
 * =============================================================
 * Permite iniciar y finalizar pausas (baño, almuerzo, descanso, etc.)
 * Muestra timer en vivo de la pausa activa.
 * Se integra en el dashboard del asesor y en el Power Dialer.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Coffee, Utensils, Timer, Users, BookOpen, HelpCircle, Play, Square, Loader2 } from 'lucide-react';
import { toast } from '@/components/shared/Toast';

type PausaActiva = { id: number; tipo: string; inicio: string; duracion_segundos: number } | null;

const TIPO_INFO: Record<string, { label: string; icon: any; color: string }> = {
  bano: { label: 'Baño', icon: Coffee, color: 'text-sky-600 bg-sky-50 border-sky-200' },
  almuerzo: { label: 'Almuerzo', icon: Utensils, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  descanso: { label: 'Descanso', icon: Timer, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  reunion: { label: 'Reunión', icon: Users, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  capacitacion: { label: 'Capacitación', icon: BookOpen, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  otro: { label: 'Otro', icon: HelpCircle, color: 'text-slate-600 bg-slate-50 border-slate-200' },
};

const TIPOS = Object.keys(TIPO_INFO);

export default function MiEstado() {
  const [pausa, setPausa] = useState<PausaActiva>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [mostrarOpciones, setMostrarOpciones] = useState(false);
  const [timer, setTimer] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchEstado = async () => {
    try {
      const res = await fetch('/api/pausas?activa=1');
      if (res.ok) {
        const data = await res.json();
        setPausa(data);
        if (data) setTimer(data.duracion_segundos || 0);
        else setTimer(0);
      }
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => {
    fetchEstado();
    const i = setInterval(fetchEstado, 30000); // refrescar cada 30s
    return () => clearInterval(i);
  }, []);

  // Timer en vivo
  useEffect(() => {
    if (pausa) {
      intervalRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setTimer(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [pausa?.id]);

  const iniciarPausa = async (tipo: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/pausas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      });
      if (res.ok) {
        const data = await res.json();
        setPausa(data);
        setTimer(0);
        toast.success(`${TIPO_INFO[tipo].label} iniciado`);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Error');
      }
    } catch {
      toast.error('Error al iniciar pausa');
    }
    setActionLoading(false);
    setMostrarOpciones(false);
  };

  const finalizarPausa = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/pausas', { method: 'PUT' });
      if (res.ok) {
        const data = await res.json();
        const mins = Math.floor(data.duracion_segundos / 60);
        const segs = data.duracion_segundos % 60;
        toast.success(`Pausa finalizada (${mins}m ${segs}s)`);
        setPausa(null);
        setTimer(0);
      } else {
        toast.error('Error al finalizar');
      }
    } catch {
      toast.error('Error al finalizar pausa');
    }
    setActionLoading(false);
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const info = pausa ? TIPO_INFO[pausa.tipo] : null;

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
        <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
        Mi Estado
      </h3>

      {pausa && info ? (
        /* ── PAUSA ACTIVA ── */
        <div className={`rounded-lg border p-3 ${info.color}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <info.icon size={18} />
              <span className="font-semibold text-sm">
                {info.label}
              </span>
            </div>
          </div>

          <div className={`text-3xl font-mono font-bold mb-3 transition-colors duration-500 ${
            timer < 300 ? 'text-slate-700 dark:text-slate-200' : timer < 900 ? 'text-amber-600' : timer < 1800 ? 'text-orange-600' : 'text-red-500'
          }`}>
            {formatTimer(timer)}
          </div>

          <button
            onClick={finalizarPausa}
            disabled={actionLoading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
            Volver a trabajar
          </button>
        </div>
      ) : (
        /* ── DISPONIBLE ── */
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Disponible</span>
          </div>

          {mostrarOpciones ? (
            <div className="space-y-1.5">
              {TIPOS.map((tipo) => {
                const Info = TIPO_INFO[tipo];
                return (
                  <button
                    key={tipo}
                    onClick={() => iniciarPausa(tipo)}
                    disabled={actionLoading}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                  >
                    <Info.icon size={14} />
                    <span>{Info.label}</span>
                  </button>
                );
              })}
              <button
                onClick={() => setMostrarOpciones(false)}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-600 py-1"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setMostrarOpciones(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Play size={14} />
              Iniciar pausa
            </button>
          )}
        </div>
      )}
    </div>
  );
}
