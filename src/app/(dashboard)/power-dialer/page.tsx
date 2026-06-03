/**
 * app/(dashboard)/power-dialer/page.tsx — Power Dialer del Asesor
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Phone, Loader2, User, Star, Gift, AlertTriangle, ChevronLeft, ChevronRight, Smartphone, PhoneCall } from 'lucide-react';

type LineaInfo = { numero: string; es_cima: boolean; tiene_renove: boolean; variante_renove: string; etiquetas: string[]; es_principal: boolean };
type Lead = { id_cliente: string; dni: string; nombre: string; paquete: string; cima: string; tiene_renove: string; renove_variante: string; lineas_count: number; pipeline_id: number; lineas: LineaInfo[] };

export default function PowerDialerPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const lastCallRef = useRef(0);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        const userId = session?.user?.id;
        if (!userId) return;
        const res = await fetch(`/api/pipeline/mine?user_id=${userId}`);
        setLeads(await res.json());
      } catch { /* */ }
      setLoading(false);
    };
    fetchLeads();
  }, []);

  const lead = leads[current];

  const call = async (numero: string) => {
    if (!lead) return;
    // Protección 5s debounce
    const now = Date.now();
    if (now - lastCallRef.current < 5000) {
      setMsg('Esperá 5 segundos entre llamadas');
      setTimeout(() => setMsg(''), 2000);
      return;
    }
    lastCallRef.current = now;

    setCalling(numero);
    setMsg(`Llamando al ${numero}...`);
    try {
      await fetch('/api/vpbx/originate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero }),
      });
      await fetch('/api/pipeline', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.pipeline_id, estado: 'contactado' }),
      });
      setMsg('Llamada iniciada');
    } catch { setMsg('Error al llamar'); }
    setCalling(null);
    setTimeout(() => setMsg(''), 3000);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={32} className="animate-spin text-[#0a6ea9]" />
    </div>
  );

  if (leads.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <Phone size={64} className="text-[#b8b0b8]" />
      <h1 className="text-xl font-bold text-[#1a1030]">Power Dialer</h1>
      <p className="text-sm text-[#7c757c]">No tenés leads asignados</p>
      <p className="text-xs text-[#b8b0b8]">Pedile a tu supervisor que te asigne leads</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a1030]">Power Dialer</h1>
          <p className="text-sm text-[#7c757c] mt-0.5">{current + 1} de {leads.length} leads</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrent(Math.max(0, current - 1))} disabled={current === 0}
            className="btn-outline p-2 disabled:opacity-30"><ChevronLeft size={16} /></button>
          <span className="text-xs text-[#7c757c]">{current + 1}/{leads.length}</span>
          <button onClick={() => setCurrent(Math.min(leads.length - 1, current + 1))} disabled={current === leads.length - 1}
            className="btn-outline p-2 disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
      </div>

      {lead && (
        <div className="card max-w-lg mx-auto">
          {/* Nombre y DNI */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-[#f0f4ff] rounded-full flex items-center justify-center mx-auto mb-3">
              <User size={32} className="text-[#0a6ea9]" />
            </div>
            <h2 className="text-lg font-bold text-[#1a1030]">{lead.nombre || 'Sin nombre'}</h2>
            <p className="text-sm text-[#7c757c] font-mono">{lead.dni}</p>
          </div>

          {/* Datos clave */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className={`rounded-lg p-3 text-center ${lead.cima === 'SI' ? 'bg-emerald-50' : 'bg-gray-50'}`}>
              <Star size={20} className={`mx-auto mb-1 ${lead.cima === 'SI' ? 'text-emerald-500' : 'text-gray-400'}`} />
              <p className="text-xs font-medium">{lead.cima === 'SI' ? 'CIMA' : 'Sin CIMA'}</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${lead.tiene_renove === 'SI' ? 'bg-blue-50' : 'bg-gray-50'}`}>
              <Gift size={20} className={`mx-auto mb-1 ${lead.tiene_renove === 'SI' ? 'text-blue-500' : 'text-gray-400'}`} />
              <p className="text-xs font-medium">{lead.tiene_renove === 'SI' ? 'Renove' : 'Sin Renove'}</p>
            </div>
          </div>

          {/* Paquete */}
          <div className="text-center mb-6 bg-[#f8f7fa] rounded-lg py-2 px-4">
            <span className="text-[10px] text-[#7c757c]">Paquete: </span>
            <span className="text-xs font-medium">{lead.paquete}</span>
          </div>

          {/* Líneas — cada una con su botón de llamar */}
          <div className="space-y-2 mb-6">
            <p className="text-[10px] font-semibold text-[#7c757c] uppercase tracking-wider">
              Líneas ({lead.lineas?.length || 0})
            </p>
            {lead.lineas?.map((l, i) => (
              <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg border ${
                l.es_principal ? 'border-[#0a6ea9] bg-blue-50' : 'border-[#e8dce6] bg-white'
              }`}>
                <div className="flex items-center gap-2">
                  <Smartphone size={14} className={l.es_principal ? 'text-[#0a6ea9]' : 'text-[#b8b0b8]'} />
                  <span className="text-sm font-mono font-medium">{l.numero}</span>
                  <div className="flex gap-1">
                    {l.etiquetas?.map((t, j) => (
                      <span key={j} className="text-[8px] bg-[#f0edf5] text-[#7c757c] rounded px-1">{t}</span>
                    ))}
                    {l.es_cima && <Star size={10} className="text-emerald-500" />}
                    {l.tiene_renove && <Gift size={10} className="text-blue-500" />}
                  </div>
                </div>
                <button onClick={() => call(l.numero)} disabled={calling === l.numero}
                  className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40">
                  {calling === l.numero ? <Loader2 size={12} className="animate-spin" /> : <PhoneCall size={12} />}
                  Llamar
                </button>
              </div>
            ))}
          </div>

          {msg && (
            <p className={`text-xs text-center mb-2 ${msg.includes('Error') || msg.includes('Esperá') ? 'text-red-500' : 'text-emerald-600'}`}>
              {msg}
            </p>
          )}

          {/* Navegación rápida */}
          <div className="flex justify-between text-xs text-[#7c757c]">
            <button onClick={() => setCurrent(0)} className="hover:text-[#0a6ea9]">← Primero</button>
            <span className="font-mono">{lead.dni}</span>
            <button onClick={() => setCurrent(leads.length - 1)} className="hover:text-[#0a6ea9]">Último →</button>
          </div>
        </div>
      )}
    </div>
  );
}
