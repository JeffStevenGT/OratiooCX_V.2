/**
 * app/(dashboard)/agenda/page.tsx — Callbacks programados
 */

'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Phone, Loader2, CheckCircle2 } from 'lucide-react';

type Callback = { id: number; id_cliente: string; dni: string; nombre: string; callback_at: string; estado: string; asesor: string; linea: string };

export default function AgendaPage() {
  const [hoy, setHoy] = useState<Callback[]>([]);
  const [manana, setManana] = useState<Callback[]>([]);
  const [semana, setSemana] = useState<Callback[]>([]);
  const [vencidos, setVencidos] = useState<Callback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/pipeline/agenda');
        const data = await res.json();
        setHoy(data.hoy || []);
        setManana(data.manana || []);
        setSemana(data.semana || []);
        setVencidos(data.vencidos || []);
      } catch { /* */ }
      setLoading(false);
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#0a6ea9]" /></div>;

  const total = hoy.length + manana.length + semana.length + vencidos.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-[#1a1030]">Agenda</h1>
        <p className="text-sm text-[#7c757c] mt-0.5">{total} callbacks programados</p>
      </div>

      {vencidos.length > 0 && (
        <Section titulo="🔴 Vencidos" icon={Clock} color="border-red-300 bg-red-50" callbacks={vencidos} urgente />
      )}
      {hoy.length > 0 && (
        <Section titulo="📅 Hoy" icon={Calendar} color="border-blue-300 bg-blue-50" callbacks={hoy} />
      )}
      {manana.length > 0 && (
        <Section titulo="📅 Mañana" icon={Calendar} color="border-emerald-300 bg-emerald-50" callbacks={manana} />
      )}
      {semana.length > 0 && (
        <Section titulo="📅 Esta semana" icon={Calendar} color="border-purple-300 bg-purple-50" callbacks={semana} />
      )}

      {total === 0 && (
        <div className="card text-center py-16">
          <Calendar size={48} className="text-[#b8b0b8] mx-auto mb-3" />
          <p className="text-sm text-[#7c757c]">No hay callbacks programados</p>
        </div>
      )}
    </div>
  );
}

function Section({ titulo, icon: Icon, color, callbacks, urgente }: any) {
  return (
    <div className={`card border-l-4 ${color}`}>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Icon size={16} /> {titulo} ({callbacks.length})
      </h3>
      <div className="space-y-2">
        {callbacks.map((c: Callback) => (
          <div key={c.id} className={`flex items-center justify-between p-2 rounded-lg ${urgente ? 'bg-red-50' : 'bg-[#f8f7fa]'}`}>
            <div className="flex items-center gap-3">
              <Phone size={14} className={urgente ? 'text-red-500' : 'text-[#7c757c]'} />
              <div>
                <p className="text-xs font-medium">{c.nombre || c.dni}</p>
                <p className="text-[10px] text-[#7c757c]">{c.dni} · {c.asesor} · {c.linea}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-xs font-bold ${urgente ? 'text-red-600' : 'text-[#1a1030]'}`}>
                {c.callback_at ? new Date(c.callback_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—'}
              </p>
              {urgente && <p className="text-[10px] text-red-400">vencido</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
