/**
 * app/(dashboard)/admin/clientes/page.tsx — Ficha 360 del Cliente
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import pool from '@/lib/db';
import { Users, Phone, Building, Calendar } from 'lucide-react';

export default async function ClientesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  // Cargar clientes desde la BD
  const { rows: clientes } = await pool.query(
    `SELECT c.*, 
            (SELECT COUNT(*) FROM clientes_proyectos cp WHERE cp.id_cliente = c.id_cliente) as num_proyectos,
            (SELECT COUNT(*) FROM historial h WHERE h.id_cliente = c.id_cliente) as num_eventos
     FROM clientes c
     ORDER BY c.created_at DESC
     LIMIT 50`
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a1030]">Clientes</h1>
          <p className="text-sm text-[#7c757c] mt-1">
            {clientes.length} clientes registrados
          </p>
        </div>
        <input
          type="text"
          placeholder="Buscar por nombre o documento..."
          className="border border-[#e0e0f0] rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#0a6ea9]/20 focus:border-[#0a6ea9]"
        />
      </div>

      {clientes.length === 0 ? (
        <div className="card text-center py-12">
          <Users size={48} className="text-[#b8b0b8] mx-auto mb-3" />
          <p className="text-sm text-[#7c757c]">
            Aún no hay clientes. El bot empezará a poblar la base de datos cuando se ejecute.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden !p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e8dce6] bg-[#f8f7fa]">
                <th className="table-header px-4 py-3 text-left">Documento</th>
                <th className="table-header px-4 py-3 text-left">Nombre / Razón Social</th>
                <th className="table-header px-4 py-3 text-left">Tipo</th>
                <th className="table-header px-4 py-3 text-left">CNAE</th>
                <th className="table-header px-4 py-3 text-left">Proyectos</th>
                <th className="table-header px-4 py-3 text-left">Eventos</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c: any) => (
                <tr key={c.id_cliente} className="border-b border-[#e8dce6] hover:bg-[#f5ebf3]/30 transition-colors cursor-pointer">
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
                  <td className="table-cell text-sm">{c.num_proyectos || 0}</td>
                  <td className="table-cell text-sm">{c.num_eventos || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
