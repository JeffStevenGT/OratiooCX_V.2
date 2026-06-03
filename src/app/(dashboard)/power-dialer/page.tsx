/**
 * app/(dashboard)/power-dialer/page.tsx — Power Dialer del Asesor (v2)
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, Loader2, User, Star, Gift, AlertTriangle, ChevronLeft, ChevronRight, Smartphone, PhoneCall, PhoneOff } from 'lucide-react';

type LineaInfo = { numero: string; es_cima: boolean; tiene_renove: boolean; variante_renove: string; etiquetas: string[]; es_principal: boolean };
type Lead = { id_cliente: string; dni: string; nombre: string; paquete: string; cima: string; tiene_renove: string; renove_variante: string; lineas_count: number; pipeline_id: number; lineas: LineaInfo[]; intentos: number };

export default function PowerDialerPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [enLlamada, setEnLlamada] = useState(false);
  const [calling, setCalling] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [intentos, setIntentos] = useState<Record<string, number>>({});
  const lastCallRef = useRef(0);

  // Protección F5 / cerrar ventana
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (enLlamada) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [enLlamada]);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        const userId = session?.user?.id;
        if (!userId) return;
        const res = await fetch(`/api/pipeline/mine?user_id=${userId}`);
        const data = await res.json();
        // Cargar intentos previos
        const intentosPrevios: Record<string, number> = {};
        for (const l of data) {
          intentosPrevios[l.id_cliente] = l.intentos || 0;
        }
        setIntentos(intentosPrevios);
        setLeads(data);
      } catch { /* */ }
      setLoading(false);
    };
    fetchLeads();
  }, []);

  const lead = leads[current];

  const call = useCallback(async (numero: string) => {
    if (!lead || enLlamada) return;

    const now = Date.now();
    if (now - lastCallRef.current < 5000) {
      setMsg('⏳ Esperá 5 segundos entre llamadas');
      setTimeout(() => setMsg(''), 2000);
      return;
    }
    lastCallRef.current = now;

    setEnLlamada(true);
    setCalling(numero);
    setMsg(`📞 Llamando al ${numero}...`);

    // Incrementar contador de intentos
    const nuevosIntentos = (intentos[lead.id_cliente] || 0) + 1;
    setIntentos(prev => ({ ...prev, [lead.id_cliente]: nuevosIntentos }));

    try {
      await fetch('/api/vpbx/originate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero }),
      });
      await fetch('/api/pipeline', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.pipeline_id, estado: 'contactado' }),
      });
      setMsg('✅ Llamada iniciada');
    } catch {
      setMsg('❌ Error al llamar');
    }

    // Simular fin de llamada después de un tiempo razonable
    setTimeout(() => {
      setEnLlamada(false);
      setCalling(null);
    }, 3000);

    setTimeout(() => setMsg(''), 4000);
  }, [lead, enLlamada, intentos]);

  const marcarNoContesta = async () => {
    if (!lead) return;
    await fetch('/api/pipeline', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.pipeline_id, estado: 'no_contesta' }),
    });
    // Pasar al siguiente
    if (current < leads.length - 1) setCurrent(current + 1);
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

  const intentosLead = intentos[lead?.id_cliente] || 0;
  const sugiereNoContesta = intentosLead >= 3;

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
          {/* Banner de llamada activa */}
          {enLlamada && (
            <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 animate-pulse">
              <PhoneCall size={14} className="text-red-500" />
              <span className="text-xs text-red-700 font-medium">En llamada — no cierres la ventana</span>
            </div>
          )}

          {/* Nombre y DNI */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-[#f0f4ff] rounded-full flex items-center justify-center mx-auto mb-3">
              <User size={32} className="text-[#0a6ea9]" />
            </div>
            <h2 className="text-lg font-bold text-[#1a1030]">{lead.nombre || 'Sin nombre'}</h2>
            <p className="text-sm text-[#7c757c] font-mono">{lead.dni}</p>
            {intentosLead > 0 && (
              <p className="text-[10px] text-[#7c757c] mt-1">Intentos: {intentosLead}</p>
            )}
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

          {/* Sugerencia no contesta */}
          {sugiereNoContesta && (
            <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-700 flex items-center gap-1">
                  <AlertTriangle size={12} /> {intentosLead} intentos sin respuesta
                </span>
                <button onClick={marcarNoContesta}
                  className="text-[10px] bg-amber-200 hover:bg-amber-300 text-amber-800 rounded px-2 py-0.5 font-medium">
                  Marcar No Contesta
                </button>
              </div>
            </div>
          )}

          {/* Paquete */}
          <div className="text-center mb-6 bg-[#f8f7fa] rounded-lg py-2 px-4">
            <span className="text-[10px] text-[#7c757c]">Paquete: </span>
            <span className="text-xs font-medium">{lead.paquete}</span>
          </div>

          {/* Líneas */}
          <div className="space-y-2 mb-4">
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
                <button onClick={() => call(l.numero)}
                  disabled={enLlamada}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    enLlamada
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : calling === l.numero
                        ? 'bg-red-100 text-red-600'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  }`}>
                  {enLlamada ? (
                    <><PhoneOff size={12} /> En llamada</>
                  ) : calling === l.numero ? (
                    <><Loader2 size={12} className="animate-spin" /> Llamando</>
                  ) : (
                    <><PhoneCall size={12} /> Llamar</>
                  )}
                </button>
              </div>
            ))}
          </div>

          {msg && (
            <p className={`text-xs text-center mb-2 ${msg.includes('✅') ? 'text-emerald-600' : msg.includes('❌') || msg.includes('⏳') ? 'text-red-500' : 'text-[#7c757c]'}`}>
              {msg}
            </p>
          )}

          {/* Navegación */}
          <div className="flex justify-between text-xs text-[#7c757c] mt-4 pt-4 border-t border-[#e8dce6]">
            <button onClick={() => setCurrent(0)} className="hover:text-[#0a6ea9]">← Primero</button>
            <span className="font-mono">{lead.dni}</span>
            <button onClick={() => setCurrent(leads.length - 1)} className="hover:text-[#0a6ea9]">Último →</button>
          </div>
        </div>
      )}
    </div>
  );
}
