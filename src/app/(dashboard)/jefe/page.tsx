/**
 * app/(dashboard)/jefe/page.tsx — Asignar Leads
 */

'use client';

import { useState, useEffect } from 'react';
import { Users, Send, Loader2, CheckCircle2, Filter, UserPlus, UserCheck } from 'lucide-react';

type Lead = { id_cliente: string; dni: string; nombre: string; tipo_persona: string; cima: string; tiene_renove: boolean; renove_variante: string; lineas_count: number; ultima_extraccion: string };
type Asesor = { id: number; nombre: string; email: string };

export default function AsignarLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [asesorId, setAsesorId] = useState('');
  const [asignando, setAsignando] = useState(false);
  const [resultado, setResultado] = useState('');
  const [cimaFilter, setCimaFilter] = useState('');
  const [renoveFilter, setRenoveFilter] = useState('');
  const [fechaFilter, setFechaFilter] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cimaFilter) params.set('cima', cimaFilter);
      if (renoveFilter) params.set('renove', renoveFilter);
      if (fechaFilter) params.set('fecha', fechaFilter);

      const [lRes, aRes] = await Promise.all([
        fetch(`/api/pipeline?${params}`),
        fetch('/api/usuarios'),
      ]);
      setLeads(await lRes.json());
      setAsesores(await aRes.json());
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [cimaFilter, renoveFilter, fechaFilter]);

  const toggleAll = () => {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map(l => l.id_cliente)));
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const asignar = async () => {
    if (!asesorId || selected.size === 0) return;
    setAsignando(true);
    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: [...selected], asesor_id: parseInt(asesorId) }),
      });
      if (res.ok) {
        setResultado(`${selected.size} leads asignados correctamente`);
        setSelected(new Set());
        fetchData();
      }
    } catch { setResultado('Error al asignar'); }
    setAsignando(false);
    setTimeout(() => setResultado(''), 4000);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a1030]">Asignar Leads</h1>
          <p className="text-sm text-[#7c757c] mt-0.5">{leads.length} leads sin asignar</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card-sm flex items-center gap-3 flex-wrap">
        <Filter size={14} className="text-[#7c757c]" />
        <select value={cimaFilter} onChange={e => setCimaFilter(e.target.value)}
          className="border border-[#e0e0f0] rounded-lg px-2.5 py-1.5 text-xs bg-white">
          <option value="">CIMA: Todos</option>
          <option value="true">CIMA: SI</option>
          <option value="false">CIMA: NO</option>
        </select>
        <select value={renoveFilter} onChange={e => setRenoveFilter(e.target.value)}
          className="border border-[#e0e0f0] rounded-lg px-2.5 py-1.5 text-xs bg-white">
          <option value="">Renove: Todos</option>
          <option value="true">Renove: SI</option>
          <option value="false">Renove: NO</option>
        </select>
        <input type="date" value={fechaFilter} onChange={e => setFechaFilter(e.target.value)}
          className="border border-[#e0e0f0] rounded-lg px-2.5 py-1.5 text-xs" />
      </div>

      {/* Asignación */}
      {selected.size > 0 && (
        <div className="card-sm bg-[#f0f4ff] border-[#c4d4f0] flex items-center gap-3">
          <UserCheck size={16} className="text-[#0a6ea9]" />
          <span className="text-sm font-medium text-[#1a1030]">{selected.size} seleccionados</span>
          <select value={asesorId} onChange={e => setAsesorId(e.target.value)}
            className="border border-[#e0e0f0] rounded-lg px-2.5 py-1.5 text-xs bg-white">
            <option value="">Elegir asesor...</option>
            {asesores.map(a => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
          <button onClick={asignar} disabled={!asesorId || asignando}
            className="btn-primary flex items-center gap-1.5 text-xs px-4 py-1.5 disabled:opacity-40">
            {asignando ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Asignar {selected.size} leads
          </button>
          {resultado && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={12} /> {resultado}
            </span>
          )}
        </div>
      )}

      {/* Tabla */}
      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-[#b8b0b8]" /></div>
        ) : leads.length === 0 ? (
          <div className="text-center py-16">
            <Users size={48} className="text-[#b8b0b8] mx-auto mb-3" />
            <p className="text-sm text-[#7c757c]">No hay leads sin asignar</p>
            <p className="text-xs text-[#b8b0b8] mt-1">El bot aún no procesó DNIs o ya fueron todos asignados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e8dce6] bg-[#f8f7fa]">
                  <th className="px-3 py-2.5 w-10">
                    <input type="checkbox" checked={selected.size === leads.length} onChange={toggleAll}
                      className="rounded border-[#d0d0e0] w-3.5 h-3.5" />
                  </th>
                  <th className="table-header px-3 py-2.5 text-left">DNI</th>
                  <th className="table-header px-3 py-2.5 text-left">Nombre</th>
                  <th className="table-header px-3 py-2.5 text-center">CIMA</th>
                  <th className="table-header px-3 py-2.5 text-center">Renove</th>
                  <th className="table-header px-3 py-2.5 text-center">Líneas</th>
                  <th className="table-header px-3 py-2.5 text-left">Variante</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(l => (
                  <tr key={l.id_cliente} onClick={() => toggle(l.id_cliente)}
                    className={`border-b border-[#f0f0f8] cursor-pointer transition-colors ${
                      selected.has(l.id_cliente) ? 'bg-[#f0f4ff]' : 'hover:bg-[#f8f7fa]'
                    }`}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={selected.has(l.id_cliente)} readOnly
                        className="rounded border-[#d0d0e0] w-3.5 h-3.5" />
                    </td>
                    <td className="py-2.5 px-3 text-xs font-mono font-medium">{l.dni}</td>
                    <td className="py-2.5 px-3 text-xs max-w-[200px] truncate" title={l.nombre}>{l.nombre || '—'}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        l.cima === 'true' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}>{l.cima === 'true' ? 'SI' : 'NO'}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        l.tiene_renove ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                      }`}>{l.tiene_renove ? 'SI' : 'NO'}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs">{l.lineas_count}</td>
                    <td className="py-2.5 px-3 text-xs max-w-[180px] truncate" title={l.renove_variante}>
                      {l.renove_variante === 'N/A' ? '—' : l.renove_variante}
                    </td>
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
