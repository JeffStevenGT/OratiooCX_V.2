/**
 * components/shared/WhatsAppChat.tsx — Chat WhatsApp solo con plantillas
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, X, MessageCircle, Loader2 } from 'lucide-react';

type Mensaje = { id: number; direccion: string; tipo: string; mensaje: string; wa_status: string; created_at: string };
type Plantilla = { id: number; nombre: string; titulo: string; mensaje: string; variables: string[]; activo: boolean };
type Props = { id_cliente: string; dni: string; nombre: string; asesorNombre?: string; onClose: () => void };

export default function WhatsAppChat({ id_cliente, dni, nombre, asesorNombre, onClose }: Props) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [numero, setNumero] = useState('');
  const [optIn, setOptIn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/clientes/${id_cliente}`).then(r => r.json()),
      fetch('/api/whatsapp/plantillas').then(r => r.json()),
    ]).then(([data, plants]) => {
      setNumero(data.whatsapp_numero || '');
      setOptIn(data.whatsapp_opt_in || false);
      setPlantillas(Array.isArray(plants) ? plants : []);
    }).catch(() => {});
  }, [id_cliente]);

  const fetchMensajes = async () => {
    try {
      const res = await fetch(`/api/whatsapp/send?id_cliente=${id_cliente}`);
      if (res.ok) setMensajes(await res.json());
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { fetchMensajes(); const i = setInterval(fetchMensajes, 10000); return () => clearInterval(i); }, [id_cliente]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensajes]);

  const enviarPlantilla = async (p: Plantilla) => {
    setSending(true); setMsg('');
    try {
      // Reemplazar variables
      const params = p.variables.map((v: string) => {
        if (v === 'nombre') return nombre || dni;
        if (v === 'asesor') return asesorNombre || 'Oratioo';
        return v;
      });
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_cliente, template: p.nombre, params }),
      });
      if (res.ok) { fetchMensajes(); setMsg('Enviado'); }
      else setMsg('Error al enviar');
    } catch { setMsg('Error'); }
    setSending(false);
    setTimeout(() => setMsg(''), 2000);
  };

  return (
    <div className="fixed bottom-4 right-4 w-80 h-96 bg-white rounded-xl shadow-2xl border border-[#e0e0f0] flex flex-col z-50 animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="bg-emerald-600 text-white px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle size={16} />
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">{nombre || dni}</p>
            <p className="text-[10px] opacity-80">{numero || 'Sin WhatsApp'}</p>
          </div>
        </div>
        <button onClick={onClose} className="hover:bg-emerald-700 rounded p-0.5"><X size={14} /></button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#e5ddd5]">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#b8b0b8]" /></div>
        ) : mensajes.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle size={32} className="text-[#b8b0b8] mx-auto mb-2" />
            <p className="text-[10px] text-[#7c757c]">Sin mensajes aún</p>
          </div>
        ) : (
          mensajes.map(m => (
            <div key={m.id} className={`flex ${m.direccion === 'saliente' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-xs ${
                m.direccion === 'saliente' ? 'bg-[#d9fdd3] text-[#1a1030]' : 'bg-white text-[#1a1030]'
              }`}>
                <p>{m.mensaje}</p>
                <p className="text-[9px] text-[#7c757c] text-right mt-0.5">
                  {new Date(m.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                  {m.wa_status && <span className="ml-1">{m.wa_status === 'read' ? '✓✓' : '✓✓'}</span>}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Plantillas */}
      {numero && (
        <div className="p-2 bg-[#f0f2f5] border-t border-[#e0e0f0] shrink-0">
          <p className="text-[9px] text-[#7c757c] mb-1.5 font-medium">Plantillas disponibles</p>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {plantillas.map(p => (
              <button key={p.id} onClick={() => enviarPlantilla(p)} disabled={sending}
                className="w-full text-left text-[10px] px-2.5 py-1.5 rounded-lg bg-white border border-[#e0e0f0] hover:bg-[#d9fdd3] hover:border-emerald-300 transition-colors disabled:opacity-50">
                <span className="font-medium">{p.titulo}</span>
                <span className="text-[#7c757c] ml-1">— {p.mensaje.substring(0, 50)}...</span>
              </button>
            ))}
          </div>
          {msg && <p className={`text-[9px] text-center mt-1 ${msg === 'Enviado' ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</p>}
        </div>
      )}

      {!numero && !loading && (
        <div className="p-3 text-center text-[10px] text-[#7c757c] border-t shrink-0">
          El cliente no tiene WhatsApp registrado
        </div>
      )}
    </div>
  );
}
