/**
 * app/(dashboard)/power-dialer/page.tsx — Power Dialer
 */

'use client';

import { useState, useEffect } from 'react';
import { Phone, CheckCircle2, XCircle, Clock, SkipForward } from 'lucide-react';

const estados_rapidos = [
  { value: 'contactado', label: 'Contactado', icon: Phone, color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'interesado', label: 'Interesado', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'negociacion', label: 'Negociación', icon: Clock, color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'venta', label: 'Venta', icon: CheckCircle2, color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'no_interesa', label: 'No Interesa', icon: XCircle, color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'no_contesta', label: 'No Contesta', icon: XCircle, color: 'bg-gray-100 text-gray-600 border-gray-300' },
];

export default function PowerDialerPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pipeline?estado=pendiente')
      .then((r) => r.json())
      .then((data) => {
        setLeads(data);
        setLoading(false);
      });
  }, []);

  const marcarEstado = async (estado: string) => {
    if (!leads[current]) return;
    await fetch('/api/pipeline', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leads[current].id, estado }),
    });
    setCurrent((prev) => Math.min(prev + 1, leads.length - 1));
  };

  const lead = leads[current];

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#1a1030]">Power Dialer</h1>

      {loading ? (
        <div className="card flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-[#0a6ea9] border-t-transparent rounded-full" />
        </div>
      ) : !lead ? (
        <div className="card text-center py-20">
          <Phone size={48} className="text-[#b8b0b8] mx-auto mb-3" />
          <p className="text-sm text-[#7c757c]">No hay leads pendientes.</p>
          <p className="text-xs text-[#b8b0b8] mt-1">Sube documentos para empezar.</p>
        </div>
      ) : (
        <>
          {/* Progreso */}
          <div className="flex items-center justify-between text-sm text-[#7c757c]">
            <span>Lead {current + 1} de {leads.length}</span>
            <div className="flex-1 mx-4 h-1 bg-[#e0e0f0] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0a6ea9] rounded-full transition-all duration-300"
                style={{ width: `${((current + 1) / leads.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Tarjeta del lead */}
          <div className="card space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-[#1a1030]">{lead.cliente_nombre || 'Sin nombre'}</h2>
              <p className="text-sm text-[#7c757c] mt-1">{lead.id_cliente}</p>
              <p className="text-xs text-[#b8b0b8]">{lead.proyecto}</p>
            </div>

            {/* Acciones */}
            <div className="grid grid-cols-3 gap-3">
              {estados_rapidos.map((e) => (
                <button
                  key={e.value}
                  onClick={() => marcarEstado(e.value)}
                  className={`flex items-center justify-center gap-2 border rounded-xl p-4 font-medium transition-all hover:shadow-sm ${e.color}`}
                >
                  <e.icon size={18} />
                  <span className="text-sm">{e.label}</span>
                </button>
              ))}
            </div>

            {/* Skip */}
            <div className="flex justify-center">
              <button
                onClick={() => setCurrent((prev) => Math.min(prev + 1, leads.length - 1))}
                className="flex items-center gap-2 text-sm text-[#7c757c] hover:text-[#1a1030] transition-colors"
              >
                <SkipForward size={16} />
                Saltar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
