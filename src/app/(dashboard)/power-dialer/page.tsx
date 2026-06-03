/**
 * app/(dashboard)/power-dialer/page.tsx — Power Dialer Progresivo (v3)
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, Loader2, User, Star, Gift, AlertTriangle, ChevronLeft, ChevronRight, Smartphone, PhoneCall, PhoneOff, Plus, CheckCircle2, XCircle } from 'lucide-react';

type LineaInfo = { numero: string; es_cima: boolean; tiene_renove: boolean; variante_renove: string; etiquetas: string[]; es_principal: boolean };
type Lead = { id_cliente: string; dni: string; nombre: string; paquete: string; cima: string; tiene_renove: string; renove_variante: string; lineas_count: number; pipeline_id: number; lineas: LineaInfo[]; intentos: number };

const RESULTADOS = [
  { key: 'contactado', label: 'Contactado', icon: CheckCircle2, color: 'bg-emerald-500' },
  { key: 'no_contesta', label: 'No Contesta', icon: XCircle, color: 'bg-red-500' },
  { key: 'buzon', label: 'Buzón', icon: PhoneOff, color: 'bg-gray-500' },
  { key: 'equivocado', label: 'Equivocado', icon: AlertTriangle, color: 'bg-amber-500' },
];

export default function PowerDialerPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [enLlamada, setEnLlamada] = useState(false);
  const [calling, setCalling] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [intentos, setIntentos] = useState<Record<string, number>>({});
  const [showResultado, setShowResultado] = useState(false);
  const [ultimoNumero, setUltimoNumero] = useState('');
  const [nota, setNota] = useState('');
  const [showAgregarNumero, setShowAgregarNumero] = useState(false);
  const [nuevoNumero, setNuevoNumero] = useState('');
  const [numerosExtra, setNumerosExtra] = useState<Record<string, string[]>>({});
  const lastCallRef = useRef(0);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (enLlamada) e.preventDefault(); };
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
        const intentosPrevios: Record<string, number> = {};
        for (const l of data) { intentosPrevios[l.id_cliente] = l.intentos || 0; }
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
      setMsg('Esperá 5 segundos entre llamadas');
      setTimeout(() => setMsg(''), 2000);
      return;
    }
    lastCallRef.current = now;
    setEnLlamada(true);
    setCalling(numero);
    setUltimoNumero(numero);
    setMsg(`Llamando al ${numero}...`);
    const nuevosIntentos = (intentos[lead.id_cliente] || 0) + 1;
    setIntentos(prev => ({ ...prev, [lead.id_cliente]: nuevosIntentos }));

    try {
      await fetch('/api/vpbx/originate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero }),
      });
    } catch { /* */ }

    setEnLlamada(false);
    setCalling(null);
    setShowResultado(true);
    setMsg('');
  }, [lead, enLlamada, intentos]);

  const guardarResultado = async (resultado: string) => {
    if (!lead) return;
    try {
      await fetch('/api/pipeline/intento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_cliente: lead.id_cliente, pipeline_id: lead.pipeline_id, numero: ultimoNumero, resultado, notas: nota }),
      });
      if (resultado === 'contactado') {
        // Lead contactado, pasar al siguiente
        if (current < leads.length - 1) setCurrent(current + 1);
      }
    } catch { /* */ }
    setShowResultado(false);
    setNota('');
  };

  const marcarNoContesta = async () => {
    if (!lead) return;
    await fetch('/api/pipeline', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.pipeline_id, estado: 'no_contesta' }),
    });
    if (current < leads.length - 1) setCurrent(current + 1);
    setShowResultado(false);
  };

  const agregarNumero = () => {
    if (!nuevoNumero || !lead) return;
    setNumerosExtra(prev => ({
      ...prev,
      [lead.id_cliente]: [...(prev[lead.id_cliente] || []), nuevoNumero],
    }));
    setUltimoNumero(nuevoNumero);
    setNuevoNumero('');
    setShowAgregarNumero(false);
    // Llamar al nuevo número
    call(nuevoNumero);
  };

  const lineasExtra = lead ? (numerosExtra[lead.id_cliente] || []) : [];
  const todasLasLineas = lead ? [
    ...lead.lineas.map(l => ({ ...l, esExtra: false })),
    ...lineasExtra.map(n => ({ numero: n, es_cima: false, tiene_renove: false, variante_renove: 'N/A', etiquetas: ['Agregado'], es_principal: false, esExtra: true })),
  ] : [];

  if (loading) return <div className="flex justify-center min-h-[60vh] items-center"><Loader2 size={32} className="animate-spin text-[#0a6ea9]" /></div>;

  if (leads.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <Phone size={64} className="text-[#b8b0b8]" />
      <h1 className="text-xl font-bold text-[#1a1030]">Power Dialer</h1>
      <p className="text-sm text-[#7c757c]">No tenés leads asignados</p>
    </div>
  );

  const intentosLead = intentos[lead?.id_cliente] || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-[#1a1030]">Power Dialer</h1><p className="text-sm text-[#7c757c]">{current + 1} de {leads.length}</p></div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrent(Math.max(0, current - 1))} disabled={current === 0} className="btn-outline p-2 disabled:opacity-30"><ChevronLeft size={16} /></button>
          <span className="text-xs text-[#7c757c]">{current + 1}/{leads.length}</span>
          <button onClick={() => setCurrent(Math.min(leads.length - 1, current + 1))} disabled={current === leads.length - 1} className="btn-outline p-2 disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
      </div>

      {lead && (
        <div className="card max-w-lg mx-auto">
          {enLlamada && (
            <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 animate-pulse">
              <PhoneCall size={14} className="text-red-500" />
              <span className="text-xs text-red-700 font-medium">En llamada — no cierres la ventana</span>
            </div>
          )}

          {/* Modal de resultado */}
          {showResultado && (
            <div className="mb-4 p-4 bg-[#f8f7fa] border border-[#e0e0f0] rounded-xl space-y-3">
              <p className="text-xs font-semibold">¿Resultado de {ultimoNumero}?</p>
              <div className="grid grid-cols-4 gap-2">
                {RESULTADOS.map(r => {
                  const Icon = r.icon;
                  return (
                    <button key={r.key} onClick={() => guardarResultado(r.key)}
                      className={`${r.color} text-white rounded-lg py-2 text-[10px] font-medium flex flex-col items-center gap-1 hover:opacity-90 transition-opacity`}>
                      <Icon size={14} /> {r.label}
                    </button>
                  );
                })}
              </div>
              <textarea value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota (opcional)..."
                className="w-full border border-[#e0e0f0] rounded-lg px-2 py-1 text-[10px]" rows={1} />
              <button onClick={marcarNoContesta}
                className="w-full text-[10px] text-red-600 hover:bg-red-50 rounded-lg py-1.5 font-medium border border-red-200">
                Marcar lead como No Contesta y pasar al siguiente
              </button>
            </div>
          )}

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-[#f0f4ff] rounded-full flex items-center justify-center mx-auto mb-3"><User size={32} className="text-[#0a6ea9]" /></div>
            <h2 className="text-lg font-bold text-[#1a1030]">{lead.nombre || 'Sin nombre'}</h2>
            <p className="text-sm text-[#7c757c] font-mono">{lead.dni}</p>
            {intentosLead > 0 && <p className="text-[10px] text-[#7c757c] mt-1">Intentos hoy: {intentosLead}</p>}
          </div>

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

          {intentosLead >= 3 && (
            <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
              <span className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle size={12} /> {intentosLead} intentos</span>
              <button onClick={marcarNoContesta} className="text-[10px] bg-amber-200 hover:bg-amber-300 text-amber-800 rounded px-2 py-0.5">No Contesta</button>
            </div>
          )}

          <div className="text-center mb-4 bg-[#f8f7fa] rounded-lg py-2 px-4">
            <span className="text-[10px] text-[#7c757c]">Paquete: </span>
            <span className="text-xs font-medium">{lead.paquete}</span>
          </div>

          {/* Líneas */}
          <div className="space-y-2 mb-4">
            <p className="text-[10px] font-semibold text-[#7c757c] uppercase tracking-wider">Líneas ({todasLasLineas.length})</p>
            {todasLasLineas.map((l, i) => (
              <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg border ${
                l.es_principal && !l.esExtra ? 'border-[#0a6ea9] bg-blue-50' :
                l.esExtra ? 'border-purple-300 bg-purple-50' : 'border-[#e8dce6] bg-white'
              }`}>
                <div className="flex items-center gap-2">
                  <Smartphone size={14} className={l.es_principal ? 'text-[#0a6ea9]' : l.esExtra ? 'text-purple-500' : 'text-[#b8b0b8]'} />
                  <span className="text-sm font-mono font-medium">{l.numero}</span>
                  <div className="flex gap-1">
                    {l.etiquetas?.map((t, j) => (
                      <span key={j} className={`text-[8px] rounded px-1 ${l.esExtra ? 'bg-purple-100 text-purple-700' : 'bg-[#f0edf5] text-[#7c757c]'}`}>{t}</span>
                    ))}
                    {l.es_cima && <Star size={10} className="text-emerald-500" />}
                    {l.tiene_renove && <Gift size={10} className="text-blue-500" />}
                  </div>
                </div>
                <button onClick={() => call(l.numero)} disabled={enLlamada}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    enLlamada ? 'bg-gray-200 text-gray-400 cursor-not-allowed' :
                    'bg-emerald-500 hover:bg-emerald-600 text-white'
                  }`}>
                  {enLlamada ? <><PhoneOff size={12} /> En llamada</> : <><PhoneCall size={12} /> Llamar</>}
                </button>
              </div>
            ))}

            {/* Agregar número */}
            {showAgregarNumero ? (
              <div className="flex items-center gap-2 p-2 rounded-lg border border-purple-300 bg-purple-50">
                <input value={nuevoNumero} onChange={e => setNuevoNumero(e.target.value)}
                  placeholder="Nuevo número..." className="flex-1 border border-[#e0e0f0] rounded-lg px-3 py-1.5 text-xs" />
                <button onClick={agregarNumero} disabled={!nuevoNumero}
                  className="bg-purple-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40">Agregar y llamar</button>
                <button onClick={() => setShowAgregarNumero(false)} className="text-xs text-[#7c757c]">Cancelar</button>
              </div>
            ) : (
              <button onClick={() => setShowAgregarNumero(true)}
                className="w-full flex items-center justify-center gap-1 p-2 rounded-lg border border-dashed border-[#d0d0e0] text-[10px] text-[#7c757c] hover:border-purple-400 hover:text-purple-600 transition-colors">
                <Plus size={12} /> Agregar número
              </button>
            )}
          </div>

          {msg && <p className="text-xs text-center mb-2 text-[#7c757c]">{msg}</p>}

          <div className="flex justify-between text-xs text-[#7c757c] mt-4 pt-4 border-t">
            <button onClick={() => setCurrent(0)} className="hover:text-[#0a6ea9]">← Primero</button>
            <span className="font-mono">{lead.dni}</span>
            <button onClick={() => setCurrent(leads.length - 1)} className="hover:text-[#0a6ea9]">Último →</button>
          </div>
        </div>
      )}
    </div>
  );
}
