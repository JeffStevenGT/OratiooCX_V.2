/**
 * app/(dashboard)/asignar-leads/page.tsx — Asignar Leads
 */

'use client';

import { useState, useEffect } from 'react';
import { Users, Send, Loader2, CheckCircle2, Filter, UserPlus, Globe, RotateCcw } from 'lucide-react';

type Lead = { id_cliente: string; dni: string; nombre: string; cima: string; tiene_renove: boolean; renove_variante: string; lineas_count: number };
type Liberado = { id_cliente: string; dni: string; nombre: string; asesor_anterior: string; liberado_at: string };
type Asesor = { id: number; nombre: string; equipo: string };

export default function AsignarLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [liberados, setLiberados] = useState<Liberado[]>([]);
  const [tab, setTab] = useState<'pendientes' | 'liberados'>('pendientes');
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [equipo, setEquipo] = useState('');
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
      const [lRes, libRes] = await Promise.all([
        fetch(`/api/pipeline?${params}`),
        fetch('/api/pipeline/liberados'),
      ]);
      setLeads(await lRes.json());
      setLiberados(await libRes.json());
    } catch { /* */ }
    setLoading(false);
  };

  const fetchAsesores = async (eq: string) => {
    const params = new URLSearchParams();
    if (eq) params.set('equipo', eq);
    const res = await fetch(`/api/usuarios?${params}`);
    setAsesores(await res.json());
  };

  useEffect(() => { fetchData(); }, [cimaFilter, renoveFilter, fechaFilter]);
  useEffect(() => { fetchAsesores(equipo); setAsesorId(''); }, [equipo]);

  const toggleAll = () => {
    const items = tab === 'pendientes' ? leads : liberados;
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map(l => l.id_cliente)));
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: [...selected], asesor_id: parseInt(asesorId) }),
      });
      if (res.ok) {
        setResultado(`${selected.size} leads asignados`);
        setSelected(new Set());
        fetchData();
      }
    } catch { setResultado('Error'); }
    setAsignando(false);
    setTimeout(() => setResultado(''), 4000);
  };

  const equipos = [...new Set(asesores.map(a => a.equipo))].filter(Boolean);
  const items = tab === 'pendientes' ? leads : liberados;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a1030]">Asignar Leads</h1>
          <p className="text-sm text-[#7c757c] mt-0.5">
            {tab === 'pendientes' ? `${leads.length} sin asignar` : `${liberados.length} liberados`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#e8dce6]">
        <button onClick={() => { setTab('pendientes'); setSelected(new Set()); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'pendientes' ? 'border-[#0a6ea9] text-[#0a6ea9]' : 'border-transparent text-[#7c757c]'}`}>
          Sin asignar ({leads.length})
        </button>
        <button onClick={() => { setTab('liberados'); setSelected(new Set()); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'liberados' ? 'border-[#0a6ea9] text-[#0a6ea9]' : 'border-transparent text-[#7c757c]'}`}>
          Liberados ({liberados.length})
        </button>
      </div>

      {tab === 'pendientes' && (
        <div className="card-sm flex items-center gap-3 flex-wrap">
          <Filter size={14} className="text-[#7c757c]" />
          <select value={cimaFilter} onChange={e => setCimaFilter(e.target.value)} className="border border-[#e0e0f0] rounded-lg px-2.5 py-1.5 text-xs bg-white">
            <option value="">CIMA: Todos</option><option value="true">CIMA: SI</option><option value="false">CIMA: NO</option>
          </select>
          <select value={renoveFilter} onChange={e => setRenoveFilter(e.target.value)} className="border border-[#e0e0f0] rounded-lg px-2.5 py-1.5 text-xs bg-white">
            <option value="">Renove: Todos</option><option value="true">Renove: SI</option><option value="false">Renove: NO</option>
          </select>
          <input type="date" value={fechaFilter} onChange={e => setFechaFilter(e.target.value)} className="border border-[#e0e0f0] rounded-lg px-2.5 py-1.5 text-xs" />
        </div>
      )}

      {tab === 'pendientes' && leads.length > 0 && (
        <div className={`card-sm flex items-center gap-3 flex-wrap ${selected.size > 0 ? 'bg-[#f0f4ff] border-[#c4d4f0]' : 'bg-[#f8f7fa]'}`}>
          <UserPlus size={16} className={selected.size > 0 ? 'text-[#0a6ea9]' : 'text-[#b8b0b8]'} />
          <span className="text-sm font-medium">
            {selected.size > 0 ? `${selected.size} seleccionados →` : 'Seleccioná leads para asignar'}
          </span>
          <Globe size={12} className="text-[#7c757c]" />
          <select value={equipo} onChange={e => setEquipo(e.target.value)} className="border border-[#e0e0f0] rounded-lg px-2.5 py-1.5 text-xs bg-white">
            <option value="">Todos los equipos</option>
            {equipos.map(eq => <option key={eq} value={eq}>{eq}</option>)}
          </select>
          <select value={asesorId} onChange={e => setAsesorId(e.target.value)} className="border border-[#e0e0f0] rounded-lg px-2.5 py-1.5 text-xs bg-white min-w-[200px]">
            <option value="">Elegir asesor...</option>
            {asesores.map(a => <option key={a.id} value={a.id}>{a.nombre} ({a.equipo || '—'})</option>)}
          </select>
          <button onClick={asignar} disabled={!asesorId || selected.size === 0 || asignando}
            className="btn-primary flex items-center gap-1.5 text-xs px-4 py-1.5 disabled:opacity-40">
            {asignando ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {selected.size > 0 ? `Asignar ${selected.size} leads` : 'Asignar'}
          </button>
          {resultado && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12} /> {resultado}</span>}
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-[#b8b0b8]" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <Users size={48} className="text-[#b8b0b8] mx-auto mb-3" />
            <p className="text-sm text-[#7c757c]">{tab === 'pendientes' ? 'No hay leads sin asignar' : 'No hay leads liberados'}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e8dce6] bg-[#f8f7fa]">
                <th className="px-3 py-2.5 w-10"><input type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={toggleAll} className="rounded w-3.5 h-3.5" /></th>
                <th className="table-header px-3 py-2.5 text-left">DNI</th>
                <th className="table-header px-3 py-2.5 text-left">Nombre</th>
                {tab === 'pendientes' ? (
                  <><th className="table-header px-3 py-2.5 text-center">CIMA</th>
                  <th className="table-header px-3 py-2.5 text-center">Renove</th>
                  <th className="table-header px-3 py-2.5 text-center">Líneas</th></>
                ) : (
                  <th className="table-header px-3 py-2.5 text-left">Asesor anterior</th>
                )}
                <th className="table-header px-3 py-2.5 text-left">{tab === 'pendientes' ? 'Variante' : 'Liberado'}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l: any) => (
                <tr key={l.id_cliente} onClick={() => toggle(l.id_cliente)}
                  className={`border-b border-[#f0f0f8] cursor-pointer ${selected.has(l.id_cliente) ? 'bg-[#f0f4ff]' : 'hover:bg-[#f8f7fa]'}`}>
                  <td className="px-3 py-2.5"><input type="checkbox" checked={selected.has(l.id_cliente)} readOnly className="rounded w-3.5 h-3.5" /></td>
                  <td className="py-2.5 px-3 text-xs font-mono font-medium">{l.dni}</td>
                  <td className="py-2.5 px-3 text-xs max-w-[200px] truncate">{l.nombre || '—'}</td>
                  {tab === 'pendientes' ? (
                    <><td className="py-2.5 px-3 text-center"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${l.cima === 'true' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{l.cima === 'true' ? 'SI' : 'NO'}</span></td>
                    <td className="py-2.5 px-3 text-center"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${l.tiene_renove ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{l.tiene_renove ? 'SI' : 'NO'}</span></td>
                    <td className="py-2.5 px-3 text-center text-xs">{l.lineas_count}</td></>
                  ) : (
                    <td className="py-2.5 px-3 text-xs">{l.asesor_anterior}</td>
                  )}
                  <td className="py-2.5 px-3 text-xs max-w-[180px] truncate">
                    {tab === 'pendientes' ? (l.renove_variante === 'N/A' ? '—' : l.renove_variante) :
                      (l.liberado_at ? new Date(l.liberado_at).toLocaleDateString('es-PE') : '—')}
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
