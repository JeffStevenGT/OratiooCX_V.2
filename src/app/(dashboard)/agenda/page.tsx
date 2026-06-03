/**
 * app/(dashboard)/agenda/page.tsx — Agenda de Callbacks
 */

'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Phone, CheckCircle2 } from 'lucide-react';

export default function AgendaPage() {
  const [callbacks, setCallbacks] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/pipeline?estado=pendiente')
      .then(r => r.json())
      .then(data => setCallbacks(data.filter((d: any) => d.callback_at)));
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#1a1030]">Agenda</h1>

      {callbacks.length === 0 ? (
        <div className="card text-center py-20">
          <Calendar size={48} className="text-[#b8b0b8] mx-auto mb-3" />
          <p className="text-sm text-[#7c757c]">No hay callbacks agendados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {callbacks.map((c: any) => (
            <div key={c.id} className="card-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock size={18} className="text-[#0a6ea9]" />
                <div>
                  <p className="text-sm font-medium">{c.cliente_nombre || c.id_cliente}</p>
                  <p className="text-xs text-[#7c757c]">{c.proyecto}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#7c757c]">
                  {c.callback_at ? new Date(c.callback_at).toLocaleString() : '—'}
                </span>
                <button className="p-1.5 rounded-lg hover:bg-emerald-50 text-[#7c757c] hover:text-emerald-600">
                  <Phone size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
