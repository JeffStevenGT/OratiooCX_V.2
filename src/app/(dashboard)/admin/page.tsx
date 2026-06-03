/**
 * app/(dashboard)/admin/page.tsx — Auditoría y Logs
 */

'use client';

import { useState, useEffect } from 'react';
import { Shield, Loader2, Filter, User, Bot, Phone, RotateCcw, AlertTriangle } from 'lucide-react';

const TIPOS = [
  { key: '', label: 'Todos' },
  { key: 'extraccion', label: 'Extracciones', icon: Bot },
  { key: 'llamada', label: 'Llamadas', icon: Phone },
  { key: 'asignacion', label: 'Asignaciones', icon: User },
  { key: 'liberacion', label: 'Liberaciones', icon: RotateCcw },
  { key: 'tipificacion', label: 'Tipificaciones', icon: AlertTriangle },
];

type Evento = { id: number; id_cliente: string; dni: string; nombre_cliente: string; tipo: string; descripcion: string; asesor_nombre: string | null; created_at: string };

export default function AuditoriaPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [tipo, setTipo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (tipo) params.set('tipo', tipo);
        const res = await fetch(`/api/auditoria?${params}`);
        setEventos(await res.json());
      } catch { /* */ }
      setLoading(false);
    };
    fetchData();
  }, [tipo]);

  const tipoBadge = (t: string) => {
    const map: Record<string, string> = {
      extraccion: 'bg-purple-100 text-purple-700',
      llamada: 'bg-blue-100 text-blue-700',
      asignacion: 'bg-emerald-100 text-emerald-700',
      liberacion: 'bg-red-100 text-red-700',
      tipificacion: 'bg-amber-100 text-amber-700',
      whatsapp: 'bg-green-100 text-green-700',
    };
    return map[t] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a1030]">Auditoría</h1>
          <p className="text-sm text-[#7c757c] mt-0.5">Historial completo del sistema</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {TIPOS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTipo(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                tipo === t.key ? 'bg-[#0a6ea9] text-white border-[#0a6ea9]' : 'bg-white text-[#7c757c] border-[#e0e0f0] hover:border-[#b8b0b8]'
              }`}>
              {Icon && <Icon size={12} />} {t.label}
            </button>
          );
        })}
      </div>

      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-[#b8b0b8]" /></div>
        ) : eventos.length === 0 ? (
          <div className="text-center py-16">
            <Shield size={48} className="text-[#b8b0b8] mx-auto mb-3" />
            <p className="text-sm text-[#7c757c]">Sin eventos registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-[#e8dce6]">
                  <th className="table-header px-4 py-2.5 text-left">Fecha</th>
                  <th className="table-header px-4 py-2.5 text-left">Tipo</th>
                  <th className="table-header px-4 py-2.5 text-left">DNI</th>
                  <th className="table-header px-4 py-2.5 text-left">Cliente</th>
                  <th className="table-header px-4 py-2.5 text-left">Descripción</th>
                  <th className="table-header px-4 py-2.5 text-left">Asesor</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map(e => (
                  <tr key={e.id} className="border-b border-[#f0f0f8] hover:bg-[#f8f7fa]">
                    <td className="py-2 px-4 text-[10px] text-[#7c757c] whitespace-nowrap">
                      {e.created_at ? new Date(e.created_at).toLocaleString('es-PE') : '—'}
                    </td>
                    <td className="py-2 px-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-medium ${tipoBadge(e.tipo)}`}>
                        {e.tipo}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-[10px] font-mono">{e.dni}</td>
                    <td className="py-2 px-4 text-[10px] max-w-[150px] truncate">{e.nombre_cliente || '—'}</td>
                    <td className="py-2 px-4 text-[10px] max-w-[300px] truncate">{e.descripcion}</td>
                    <td className="py-2 px-4 text-[10px]">{e.asesor_nombre || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
