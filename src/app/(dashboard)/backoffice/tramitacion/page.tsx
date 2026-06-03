/**
 * app/(dashboard)/backoffice/tramitacion/page.tsx — Pipeline de Ventas
 */

'use client';

import { useState, useEffect } from 'react';
import { Package, CheckCircle2, Clock, XCircle } from 'lucide-react';

const estados = [
  { value: 'pendiente', label: 'Pendiente', icon: Clock, color: 'bg-amber-100 text-amber-700' },
  { value: 'contactado', label: 'Contactado', icon: Clock, color: 'bg-blue-100 text-blue-700' },
  { value: 'interesado', label: 'Interesado', icon: Clock, color: 'bg-purple-100 text-purple-700' },
  { value: 'negociacion', label: 'Negociación', icon: Clock, color: 'bg-indigo-100 text-indigo-700' },
  { value: 'venta', label: 'Venta', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'tramitado', label: 'Tramitado', icon: Package, color: 'bg-teal-100 text-teal-700' },
  { value: 'activado', label: 'Activado', icon: CheckCircle2, color: 'bg-green-100 text-green-700' },
  { value: 'no_interesa', label: 'No Interesa', icon: XCircle, color: 'bg-red-100 text-red-700' },
  { value: 'no_contesta', label: 'No Contesta', icon: XCircle, color: 'bg-gray-100 text-gray-600' },
];

export default function TramitacionPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('venta');

  useEffect(() => {
    fetch(`/api/pipeline?estado=${filter}`)
      .then((r) => r.json())
      .then(setItems)
      .finally(() => setLoading(false));
  }, [filter]);

  const cambiarEstado = async (id: number, nuevoEstado: string) => {
    await fetch('/api/pipeline', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado: nuevoEstado }),
    });
    setItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#1a1030]">Tramitación de Ventas</h1>

      {/* Filtros de estado */}
      <div className="flex gap-2 flex-wrap">
        {estados.slice(3).map((e) => (
          <button
            key={e.value}
            onClick={() => setFilter(e.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === e.value ? e.color + ' ring-2 ring-offset-1' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card flex items-center justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-[#0a6ea9] border-t-transparent rounded-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle2 size={48} className="text-emerald-300 mx-auto mb-3" />
          <p className="text-sm text-[#7c757c]">No hay {estados.find(e => e.value === filter)?.label}s pendientes.</p>
        </div>
      ) : (
        <div className="card overflow-hidden !p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e8dce6] bg-[#f8f7fa]">
                <th className="table-header px-4 py-3 text-left">Cliente</th>
                <th className="table-header px-4 py-3 text-left">Proyecto</th>
                <th className="table-header px-4 py-3 text-left">Estado</th>
                <th className="table-header px-4 py-3 text-left">Último cambio</th>
                <th className="table-header px-4 py-3 text-left">Acción</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-b border-[#e8dce6] hover:bg-[#f5ebf3]/30">
                  <td className="table-cell text-sm font-medium">{item.cliente_nombre || item.id_cliente}</td>
                  <td className="table-cell text-sm">{item.proyecto}</td>
                  <td className="table-cell">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${estados.find(e => e.value === item.estado)?.color || ''}`}>
                      {estados.find(e => e.value === item.estado)?.label || item.estado}
                    </span>
                  </td>
                  <td className="table-cell text-xs text-[#7c757c]">
                    {item.ultimo_cambio ? new Date(item.ultimo_cambio).toLocaleString() : '—'}
                  </td>
                  <td className="table-cell">
                    <select
                      value={item.estado}
                      onChange={(e) => cambiarEstado(item.id, e.target.value)}
                      className="border border-[#e0e0f0] rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#0a6ea9]/20"
                    >
                      {estados.map((e) => (
                        <option key={e.value} value={e.value}>{e.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
