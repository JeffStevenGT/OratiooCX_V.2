/**
 * app/(dashboard)/backoffice/tramitacion/page.tsx — Tramitación de Ventas
 */

'use client';

import { useState, useEffect } from 'react';
import { Package, CheckCircle2, Loader2, User, FileText } from 'lucide-react';

type Venta = { id: number; id_cliente: string; dni: string; nombre: string; asesor: string; ultimo_cambio: string; paquete: string };

export default function TramitacionPage() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const fetchVentas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pipeline/tramitacion');
      setVentas(await res.json());
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { fetchVentas(); }, []);

  const tramitar = async (id: number) => {
    try {
      await fetch('/api/pipeline', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado: 'tramitado' }),
      });
      setMsg('Venta tramitada');
      fetchVentas();
    } catch { setMsg('Error'); }
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a1030]">Tramitación</h1>
          <p className="text-sm text-[#7c757c] mt-0.5">{ventas.length} ventas pendientes</p>
        </div>
      </div>

      {msg && <div className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs">{msg}</div>}

      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-[#b8b0b8]" /></div>
        ) : ventas.length === 0 ? (
          <div className="text-center py-16">
            <Package size={48} className="text-[#b8b0b8] mx-auto mb-3" />
            <p className="text-sm text-[#7c757c]">No hay ventas pendientes de tramitar</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e8dce6] bg-[#f8f7fa]">
                <th className="table-header px-4 py-2.5 text-left">DNI</th>
                <th className="table-header px-4 py-2.5 text-left">Cliente</th>
                <th className="table-header px-4 py-2.5 text-left">Asesor</th>
                <th className="table-header px-4 py-2.5 text-left">Paquete</th>
                <th className="table-header px-4 py-2.5 text-left">Fecha Venta</th>
                <th className="table-header px-4 py-2.5 text-center w-24">Acción</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map(v => (
                <tr key={v.id} className="border-b border-[#f0f0f8] hover:bg-[#f8f7fa]">
                  <td className="py-2.5 px-4 text-xs font-mono font-medium">{v.dni}</td>
                  <td className="py-2.5 px-4 text-xs max-w-[180px] truncate" title={v.nombre}>{v.nombre || '—'}</td>
                  <td className="py-2.5 px-4 text-xs">{v.asesor}</td>
                  <td className="py-2.5 px-4 text-xs max-w-[150px] truncate">{v.paquete}</td>
                  <td className="py-2.5 px-4 text-xs text-[#7c757c]">
                    {v.ultimo_cambio ? new Date(v.ultimo_cambio).toLocaleDateString('es-PE') : '—'}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <button onClick={() => tramitar(v.id)}
                      className="btn-success text-[10px] px-3 py-1 flex items-center gap-1 mx-auto">
                      <CheckCircle2 size={10} /> Tramitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
