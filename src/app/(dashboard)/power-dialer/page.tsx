/**
 * app/(dashboard)/power-dialer/page.tsx — Power Dialer del Asesor
 */

'use client';

import { useState, useEffect } from 'react';
import { Phone, Loader2, User, Star, Gift, AlertTriangle, ChevronLeft, ChevronRight, Smartphone } from 'lucide-react';

type Lead = { id_cliente: string; dni: string; nombre: string; linea_principal: string; paquete: string; cima: string; tiene_renove: string; renove_variante: string; lineas_count: number; pipeline_id: number };

export default function PowerDialerPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        const userId = session?.user?.id;
        if (!userId) return;

        // Obtener leads asignados a este asesor con datos del bot
        const res = await fetch(`/api/pipeline/mine?user_id=${userId}`);
        const data = await res.json();
        setLeads(data);
      } catch { /* */ }
      setLoading(false);
    };
    fetchLeads();
  }, []);

  const lead = leads[current];

  const call = async () => {
    if (!lead) return;
    setCalling(true);
    setMsg('Llamando...');
    try {
      await fetch('/api/vpbx/originate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: lead.linea_principal }),
      });
      // Marcar como contactado
      await fetch('/api/pipeline', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.pipeline_id, estado: 'contactado' }),
      });
      setMsg('Llamada iniciada');
    } catch { setMsg('Error al llamar'); }
    setCalling(false);
    setTimeout(() => setMsg(''), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-[#0a6ea9]" />
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Phone size={64} className="text-[#b8b0b8]" />
        <div>
          <h1 className="text-xl font-bold text-[#1a1030]">Power Dialer</h1>
          <p className="text-sm text-[#7c757c] mt-1">No tenés leads asignados</p>
          <p className="text-xs text-[#b8b0b8] mt-0.5">Pedile a tu supervisor que te asigne leads desde Asignar Leads</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
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

      {/* Ficha del lead */}
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

          {/* Info del cliente */}
          <div className="space-y-2 mb-6 bg-[#f8f7fa] rounded-lg p-4">
            <div className="flex justify-between text-xs">
              <span className="text-[#7c757c]">Línea principal</span>
              <span className="font-mono font-medium">{lead.linea_principal}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#7c757c]">Paquete</span>
              <span className="text-right max-w-[200px] truncate">{lead.paquete}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#7c757c]">Líneas totales</span>
              <span>{lead.lineas_count}</span>
            </div>
            {lead.renove_variante && lead.renove_variante !== 'N/A' && (
              <div className="flex justify-between text-xs">
                <span className="text-[#7c757c]">Tipo Renove</span>
                <span className="text-blue-600 font-medium text-right">{lead.renove_variante}</span>
              </div>
            )}
          </div>

          {/* Botón llamar */}
          <button onClick={call} disabled={calling}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-4 flex items-center justify-center gap-3 text-lg font-semibold transition-colors disabled:opacity-50">
            {calling ? <Loader2 size={24} className="animate-spin" /> : <Phone size={24} />}
            {calling ? 'Llamando...' : `Llamar al ${lead.linea_principal}`}
          </button>
          {msg && <p className="text-xs text-center mt-2 text-emerald-600">{msg}</p>}

          {/* Navegación */}
          <div className="flex justify-between mt-4 text-xs text-[#7c757c]">
            <button onClick={() => { setCurrent(0); }} className="hover:text-[#0a6ea9]">← Primero</button>
            <span>{lead.linea_principal}</span>
            <button onClick={() => { setCurrent(leads.length - 1); }} className="hover:text-[#0a6ea9]">Último →</button>
          </div>
        </div>
      )}
    </div>
  );
}
