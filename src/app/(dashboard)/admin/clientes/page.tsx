/**
 * app/(dashboard)/admin/clientes/page.tsx — Tabla de Clientes con Ficha 360
 */

'use client';

import { useState, useEffect } from 'react';
import { Users, Building, Search } from 'lucide-react';
import FichaCliente from '@/components/clientes/FichaCliente';

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/clientes')
      .then((r) => r.json())
      .then(setClientes)
      .finally(() => setLoading(false));
  }, []);

  const filtered = clientes.filter((c: any) =>
    !search || (c.nombre_razon_social || '').toLowerCase().includes(search.toLowerCase()) ||
    c.numero_documento.includes(search)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a1030]">Clientes</h1>
          <p className="text-sm text-[#7c757c] mt-1">{filtered.length} clientes</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b8b0b8]" />
          <input
            type="text"
            placeholder="Buscar por nombre o documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-[#e0e0f0] rounded-lg pl-9 pr-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-[#0a6ea9]/20 focus:border-[#0a6ea9]"
          />
        </div>
      </div>

      {loading ? (
        <div className="card flex items-center justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-[#0a6ea9] border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Users size={48} className="text-[#b8b0b8] mx-auto mb-3" />
          <p className="text-sm text-[#7c757c]">Aún no hay clientes.</p>
        </div>
      ) : (
        <div className="card overflow-hidden !p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e8dce6] bg-[#f8f7fa]">
                <th className="table-header px-4 py-3 text-left">Documento</th>
                <th className="table-header px-4 py-3 text-left">Nombre</th>
                <th className="table-header px-4 py-3 text-left">Tipo</th>
                <th className="table-header px-4 py-3 text-left">CNAE</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => (
                <tr
                  key={c.id_cliente}
                  onClick={() => setSelected(c.id_cliente)}
                  className="border-b border-[#e8dce6] hover:bg-[#f5ebf3]/30 transition-colors cursor-pointer"
                >
                  <td className="table-cell font-mono text-sm font-medium">
                    {c.tipo_documento} {c.numero_documento}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      {c.tipo_persona === 'empresa' ? (
                        <Building size={14} className="text-[#481163]" />
                      ) : (
                        <Users size={14} className="text-[#0a6ea9]" />
                      )}
                      <span className="text-sm">{c.nombre_razon_social || 'Sin nombre'}</span>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      c.tipo_persona === 'empresa' ? 'bg-purple-50 text-purple-700' :
                      c.tipo_persona === 'autonomo' ? 'bg-amber-50 text-amber-700' :
                      'bg-blue-50 text-blue-700'
                    }`}>
                      {c.tipo_persona || 'natural'}
                    </span>
                  </td>
                  <td className="table-cell text-sm text-[#7c757c]">{c.cnae || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <FichaCliente clienteId={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
