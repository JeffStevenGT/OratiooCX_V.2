/**
 * components/clientes/FichaCliente.tsx — Ficha 360 Detallada
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Phone, Mail, Building, Calendar, Clock, MapPin, Users } from 'lucide-react';

interface Cliente {
  id_cliente: string;
  tipo_documento: string;
  numero_documento: string;
  nombre_razon_social: string;
  tipo_persona: string;
  cnae: string;
  telefonos: string[];
  telefonos_v2: { num: string; tipo: string; origen: string }[];
  emails: string[];
  direccion: any;
  proyectos_datos: any[];
  historial: any[];
  pipeline: any[];
}

interface Props {
  clienteId: string;
  onClose: () => void;
}

export default function FichaCliente({ clienteId, onClose }: Props) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'historial' | 'proyectos' | 'pipeline'>('info');

  useEffect(() => {
    fetch(`/api/clientes/${clienteId}`)
      .then((r) => r.json())
      .then(setCliente)
      .finally(() => setLoading(false));
  }, [clienteId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
        <div className="bg-white rounded-2xl w-full max-w-3xl mx-4 h-[80vh] flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#0a6ea9] border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!cliente) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl mx-4 h-[85vh] flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#e0e0f0] shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[#1a1030]">{cliente.nombre_razon_social}</h2>
            <p className="text-xs text-[#7c757c] mt-0.5">
              {cliente.tipo_documento} {cliente.numero_documento}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#f0f0f8] text-[#868686]">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#e0e0f0] px-5 shrink-0">
          {(['info', 'historial', 'proyectos', 'pipeline'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-[#0a6ea9] text-[#0a6ea9]' : 'border-transparent text-[#7c757c] hover:text-[#1a1030]'
              }`}
            >
              {t === 'info' ? 'Info' : t === 'historial' ? 'Historial' : t === 'proyectos' ? 'Proyectos' : 'Pipeline'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InfoCard icon={Users} label="Tipo" value={cliente.tipo_persona || 'natural'} />
                <InfoCard icon={Building} label="CNAE" value={cliente.cnae || 'No registrado'} />
              </div>
              {(() => {
                const phones = (cliente.telefonos_v2?.length > 0)
                  ? cliente.telefonos_v2
                  : (cliente.telefonos || []).map((t: string) => ({ num: t, tipo: 'extraido', origen: 'bot' }));
                if (phones.length === 0) return null;
                return (
                  <Section title="Teléfonos" icon={Phone}>
                    {phones.map((t: any, i: number) => (
                      <span key={i} className={`text-sm font-mono px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                        t.tipo === 'contacto' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                        t.tipo === 'agregado' ? 'bg-purple-50 text-purple-800 border border-purple-200' :
                        'bg-[#f8f7fa]'
                      }`}>
                        {t.num}
                        {t.tipo === 'contacto' && <span className="text-[8px] bg-emerald-200 text-emerald-800 rounded px-1 font-sans">Principal</span>}
                        {t.tipo === 'agregado' && <span className="text-[8px] bg-purple-200 text-purple-800 rounded px-1 font-sans">Agregado</span>}
                      </span>
                    ))}
                  </Section>
                );
              })()}
              {(cliente.emails || []).length > 0 && (
                <Section title="Emails" icon={Mail}>
                  {cliente.emails.map((e: string, i: number) => (
                    <span key={i} className="text-sm bg-[#f8f7fa] px-3 py-1.5 rounded-lg">{e}</span>
                  ))}
                </Section>
              )}
              {cliente.direccion && Object.keys(cliente.direccion).length > 0 && (
                <Section title="Dirección" icon={MapPin}>
                  <span className="text-sm text-[#7c757c]">
                    {cliente.direccion.calle}, {cliente.direccion.ciudad} {cliente.direccion.cp}
                  </span>
                </Section>
              )}
            </div>
          )}

          {tab === 'historial' && (
            <Timeline eventos={cliente.historial || []} />
          )}

          {tab === 'proyectos' && (
            <div className="space-y-3">
              {(cliente.proyectos_datos || []).map((p: any, i: number) => (
                <div key={i} className="bg-[#f8f7fa] rounded-lg p-4 border border-[#e8dce6]">
                  <h3 className="text-sm font-semibold text-[#481163]">{p.nombre}</h3>
                  <pre className="text-xs text-[#7c757c] mt-2 whitespace-pre-wrap font-mono">
                    {JSON.stringify(p.datos, null, 2).slice(0, 500)}
                  </pre>
                </div>
              ))}
              {(cliente.proyectos_datos || []).length === 0 && (
                <p className="text-sm text-[#7c757c] text-center py-8">Sin proyectos asignados.</p>
              )}
            </div>
          )}

          {tab === 'pipeline' && (
            <div className="space-y-2">
              {(cliente.pipeline || []).map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between bg-[#f8f7fa] rounded-lg px-4 py-3 border border-[#e8dce6]">
                  <span className="text-sm font-medium">{p.proyecto}</span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                    p.estado === 'venta' ? 'bg-emerald-50 text-emerald-700' :
                    p.estado === 'pendiente' ? 'bg-amber-50 text-amber-600' :
                    'bg-blue-50 text-blue-700'
                  }`}>
                    {p.estado}
                  </span>
                </div>
              ))}
              {(cliente.pipeline || []).length === 0 && (
                <p className="text-sm text-[#7c757c] text-center py-8">Sin pipeline activo.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-[#f8f7fa] rounded-lg p-3 border border-[#e8dce6]">
      <p className="text-[10px] font-semibold text-[#7c757c] uppercase tracking-wider flex items-center gap-1.5">
        <Icon size={12} /> {label}
      </p>
      <p className="text-sm font-medium text-[#1a1030] mt-1">{value}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-[#7c757c] uppercase tracking-wider flex items-center gap-1.5 mb-2">
        <Icon size={12} /> {title}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Timeline({ eventos }: { eventos: any[] }) {
  if (eventos.length === 0) {
    return <p className="text-sm text-[#7c757c] text-center py-8">Sin eventos registrados.</p>;
  }

  return (
    <div className="relative pl-6 border-l-2 border-[#e0e0f0] space-y-4">
      {eventos.map((e: any, i: number) => (
        <div key={i} className="relative">
          <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-[#0a6ea9] border-2 border-white" />
          <div className="bg-[#f8f7fa] rounded-lg p-3 border border-[#e8dce6]">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold text-[#481163] uppercase">{e.tipo}</span>
              <span className="text-[10px] text-[#b8b0b8]">·</span>
              <span className="text-[10px] text-[#7c757c]">
                {new Date(e.created_at).toLocaleDateString('es-PE', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            <p className="text-sm text-[#1a1030]">{e.descripcion}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
