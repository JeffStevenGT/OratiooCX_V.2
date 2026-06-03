/**
 * app/(dashboard)/clientes/page.tsx — Tabla de Clientes estilo master
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search, Loader2, RefreshCw, ArrowUpDown, ChevronDown, ChevronUp,
  Download, FileSpreadsheet, Users, Building, User, Smartphone, PhoneOff, Gift,
  Clock, TrendingUp, AlertTriangle, Star, StarOff, Tv,
  UserPlus, UserMinus, Package,
} from 'lucide-react';

type Cliente = {
  id_cliente: string; dni: string; tipo_documento: string; nombre: string;
  tipo_persona: string; linea_principal: string; paquete: string;
  cima: string; tiene_renove: string; renove_variante: string;
  fecha: string; hora: string; estado: string;
  lineas: any[]; header: any; cima_global: boolean;
};

const PAGE_SIZES = [10, 25, 50, 100];

const VARIANTES = [
  { key: 'maximo', label: 'Máx descuento', text: 'Renove mixto al mejor precio con máximo descuento' },
  { key: 'con_descuento', label: 'Con descuento', text: 'Renove mixto al mejor precio con descuento' },
  { key: 'mejor_precio', label: 'Mejor precio', text: 'Renove mixto al mejor precio' },
  { key: 'renove_mixto', label: 'Renove mixto', text: 'Renove mixto' },
];

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [cimaFilter, setCimaFilter] = useState<string | null>(null);
  const [renoveFilter, setRenoveFilter] = useState<string | null>(null);
  const [variantesActivas, setVariantesActivas] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [editingTipo, setEditingTipo] = useState<string | null>(null);
  const [deteccionesCache, setDeteccionesCache] = useState<Record<string, any[]>>({});
  const [timelineCache, setTimelineCache] = useState<Record<string, any[]>>({});
  const [loadingDetecciones, setLoadingDetecciones] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clientes');
      setClientes(await res.json());
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { fetchClientes(); }, []);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, cimaFilter, renoveFilter, variantesActivas, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    let result = [...clientes];

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(c =>
        c.dni?.toLowerCase().includes(q) ||
        c.nombre?.toLowerCase().includes(q) ||
        c.linea_principal?.toLowerCase().includes(q)
      );
    }

    // CIMA
    if (cimaFilter) result = result.filter(c => c.cima === cimaFilter);

    // Renove
    if (renoveFilter) result = result.filter(c => c.tiene_renove === renoveFilter);

    // Variantes
    if (variantesActivas.length > 0) {
      result = result.filter(c =>
        variantesActivas.some(vk => {
          const v = VARIANTES.find(x => x.key === vk);
          return v && c.renove_variante === v.text;
        })
      );
    }

    // Date range
    if (dateFrom) result = result.filter(c => c.fecha >= dateFrom);
    if (dateTo) result = result.filter(c => c.fecha <= dateTo);

    // Sort
    if (sortKey) {
      result.sort((a: any, b: any) => {
        const av = a[sortKey] || ''; const bv = b[sortKey] || '';
        return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    }

    return result;
  }, [clientes, search, cimaFilter, renoveFilter, variantesActivas, dateFrom, dateTo, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const updateTipo = async (id: string, tipo: string) => {
    await fetch(`/api/clientes/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo_persona: tipo }),
    });
    setClientes(prev => prev.map(c => c.id_cliente === id ? { ...c, tipo_persona: tipo } : c));
    setEditingTipo(null);
  };

  const exportCSV = () => {
    const headers = ['DNI', 'Nombre', 'CIMA', 'Línea Principal', 'Paquete', 'Tipo Renove', 'Variante', 'Fecha', 'Hora'];
    const rows = filtered.map(c => [
      c.dni, c.nombre, c.cima, c.linea_principal, c.paquete,
      c.tiene_renove, c.renove_variante, c.fecha, c.hora,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'clientes_orange.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const headers = ['DNI', 'Nombre', 'CIMA', 'Línea', 'Paquete', 'Renove', 'Variante', 'Fecha', 'Hora'];
    const rows = filtered.map(c => [c.dni, c.nombre, c.cima, c.linea_principal, c.paquete, c.tiene_renove, c.renove_variante, c.fecha, c.hora]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes Orange');
    XLSX.writeFile(wb, 'clientes_orange.xlsx');
  };

  const SortHeader = ({ label, sk }: { label: string; sk: string }) => (
    <th className="table-header px-3 py-2.5 cursor-pointer hover:text-[#1a1030] select-none" onClick={() => toggleSort(sk)}>
      <div className="flex items-center gap-1">
        {label}
        {sortKey === sk ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
          : <ArrowUpDown size={11} className="opacity-30" />}
      </div>
    </th>
  );

  const TipoBadge = ({ tipo }: { tipo: string }) => {
    const map: Record<string, { icon: any; label: string; color: string }> = {
      natural: { icon: User, label: 'Natural', color: 'bg-blue-100 text-blue-700' },
      autonomo: { icon: User, label: 'Autónomo', color: 'bg-amber-100 text-amber-700' },
      empresa: { icon: Building, label: 'Empresa', color: 'bg-purple-100 text-purple-700' },
    };
    const b = map[tipo] || map.natural;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${b.color}`}>
        <b.icon size={10} /> {b.label}
      </span>
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a1030]">Clientes</h1>
          <p className="text-sm text-[#7c757c] mt-0.5">{filtered.length} resultados</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchClientes} disabled={loading}
            className="btn-outline flex items-center gap-1.5 text-xs px-3 py-1.5">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refrescar
          </button>
          <button onClick={exportCSV} disabled={filtered.length === 0}
            className="btn-outline flex items-center gap-1.5 text-xs px-3 py-1.5">
            <Download size={12} /> CSV
          </button>
          <button onClick={exportExcel} disabled={filtered.length === 0}
            className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5">
            <FileSpreadsheet size={12} /> Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card-sm flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#b8b0b8]" />
          <input placeholder="Buscar DNI, nombre o línea..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-[#e0e0f0] rounded-lg pl-8 pr-3 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-[#0a6ea9]/30" />
        </div>

        {/* CIMA */}
        <select value={cimaFilter || ''} onChange={e => setCimaFilter(e.target.value || null)}
          className="border border-[#e0e0f0] rounded-lg px-2.5 py-1.5 text-xs bg-white">
          <option value="">CIMA: Todos</option>
          <option value="SI">CIMA: SI</option>
          <option value="NO">CIMA: NO</option>
        </select>

        {/* Renove */}
        <select value={renoveFilter || ''} onChange={e => setRenoveFilter(e.target.value || null)}
          className="border border-[#e0e0f0] rounded-lg px-2.5 py-1.5 text-xs bg-white">
          <option value="">Renove: Todos</option>
          <option value="SI">Renove: SI</option>
          <option value="NO">Renove: NO</option>
        </select>

        {/* Variantes */}
        <div className="flex gap-1 flex-wrap">
          {VARIANTES.map(v => (
            <button key={v.key} onClick={() => setVariantesActivas(prev =>
              prev.includes(v.key) ? prev.filter(x => x !== v.key) : [...prev, v.key]
            )}
              className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                variantesActivas.includes(v.key)
                  ? 'bg-[#0a6ea9] text-white border-[#0a6ea9]'
                  : 'bg-white text-[#7c757c] border-[#e0e0f0] hover:border-[#b8b0b8]'
              }`}>{v.label}</button>
          ))}
        </div>

        {/* Dates */}
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="border border-[#e0e0f0] rounded-lg px-2.5 py-1.5 text-xs" />
        <span className="text-xs text-[#7c757c]">a</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="border border-[#e0e0f0] rounded-lg px-2.5 py-1.5 text-xs" />
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-[#b8b0b8]" /></div>
        ) : paged.length === 0 ? (
          <div className="text-center py-16">
            <Users size={48} className="text-[#b8b0b8] mx-auto mb-3" />
            <p className="text-sm text-[#7c757c]">No se encontraron clientes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e8dce6] bg-[#f8f7fa]">
                  <SortHeader label="DNI" sk="dni" />
                  <SortHeader label="Nombre" sk="nombre" />
                  <SortHeader label="CIMA" sk="cima" />
                  <SortHeader label="Línea" sk="linea_principal" />
                  <SortHeader label="Paquete" sk="paquete" />
                  <SortHeader label="Renove" sk="tiene_renove" />
                  <SortHeader label="Variante" sk="renove_variante" />
                  <SortHeader label="Fecha" sk="fecha" />
                  <SortHeader label="Hora" sk="hora" />
                </tr>
              </thead>
              <tbody>
                {paged.map(c => (
                  <>
                    <tr key={c.id_cliente}
                      onClick={async () => {
                        const nuevo = expandido === c.id_cliente ? null : c.id_cliente;
                        setExpandido(nuevo);
                        if (nuevo && !deteccionesCache[nuevo]) {
                          setLoadingDetecciones(true);
                          try {
                            const [detRes, tlRes] = await Promise.all([
                              fetch(`/api/clientes/${nuevo}`),
                              fetch(`/api/auditoria?tipo=&limit=20`),
                            ]);
                            const detData = await detRes.json();
                            const tlData = await tlRes.json();
                            setDeteccionesCache(prev => ({ ...prev, [nuevo]: detData.detecciones || [] }));
                            setTimelineCache(prev => ({ ...prev, [nuevo]: tlData.filter((e: any) => e.id_cliente === nuevo) }));
                          } catch { /* */ }
                          setLoadingDetecciones(false);
                        }
                      }}
                      className={`border-b border-[#f0f0f8] hover:bg-[#f8f7fa] cursor-pointer transition-colors ${
                        expandido === c.id_cliente ? 'bg-[#f5f0fa]' : ''
                      }`}>
                      <td className="py-2.5 px-3 text-xs font-mono font-medium">{c.dni}</td>
                      <td className="py-2.5 px-3 text-xs max-w-[180px] truncate" title={c.nombre}>{c.nombre}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          c.cima === 'SI' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        }`}>{c.cima}</span>
                      </td>
                      <td className="py-2.5 px-3 text-xs font-mono">{c.linea_principal}</td>
                      <td className="py-2.5 px-3 text-xs max-w-[120px] truncate" title={c.paquete}>{c.paquete}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          c.tiene_renove === 'SI' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                        }`}>{c.tiene_renove}</span>
                      </td>
                      <td className="py-2.5 px-3 text-xs max-w-[160px] truncate" title={c.renove_variante}>
                        {c.renove_variante}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-[#7c757c]">{c.fecha}</td>
                      <td className="py-2.5 px-3 text-xs text-[#7c757c]">{c.hora}</td>
                    </tr>

                    {/* Expandible */}
                    {expandido === c.id_cliente && (
                      <tr key={`exp-${c.id_cliente}`}>
                        <td colSpan={9} className="bg-[#faf8fc] border-b border-[#e8dce6] p-0">
                          <div className="px-6 py-4 space-y-4">
                            {/* Cabecera */}
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-[#1a1030]">{c.nombre}</p>
                                <p className="text-xs text-[#7c757c]">{c.tipo_documento} {c.dni}</p>
                              </div>
                              {/* Tipo persona editable */}
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-[#7c757c]">Tipo:</span>
                                {editingTipo === c.id_cliente ? (
                                  <select
                                    value={c.tipo_persona}
                                    onChange={e => updateTipo(c.id_cliente, e.target.value)}
                                    onBlur={() => setEditingTipo(null)}
                                    autoFocus
                                    className="border border-[#e0e0f0] rounded-lg px-2 py-1 text-[10px] bg-white">
                                    <option value="natural">Natural</option>
                                    <option value="autonomo">Autónomo</option>
                                    <option value="empresa">Empresa</option>
                                  </select>
                                ) : (
                                  <button onClick={(e) => { e.stopPropagation(); setEditingTipo(c.id_cliente); }}
                                    className="cursor-pointer">
                                    <TipoBadge tipo={c.tipo_persona} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Resumen */}
                            <div className="grid grid-cols-4 gap-3">
                              <MiniStat label="CIMA" value={c.cima} color={c.cima === 'SI' ? 'emerald' : 'gray'} />
                              <MiniStat label="Renove Mixto" value={c.tiene_renove} color={c.tiene_renove === 'SI' ? 'blue' : 'gray'} />
                              <MiniStat label="Paquete" value={c.paquete} color="slate" />
                              <MiniStat label="Líneas" value={String(c.lineas?.length || 0)} color="purple" />
                            </div>

                            {/* Líneas */}
                            {c.lineas && c.lineas.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-[#1a1030] mb-2">
                                  Líneas ({c.lineas.length})
                                </h4>
                                <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-lg border border-[#e8dce6]">
                                  <table className="w-full text-[10px]">
                                    <thead className="sticky top-0 bg-[#f0edf5]">
                                      <tr>
                                        <th className="px-2.5 py-1.5 text-left font-medium text-[#7c757c]">Número</th>
                                        <th className="px-2.5 py-1.5 text-left font-medium text-[#7c757c]">CIMA</th>
                                        <th className="px-2.5 py-1.5 text-left font-medium text-[#7c757c]">Estado</th>
                                        <th className="px-2.5 py-1.5 text-left font-medium text-[#7c757c]">Consumo</th>
                                        <th className="px-2.5 py-1.5 text-left font-medium text-[#7c757c]">Permanencia</th>
                                        <th className="px-2.5 py-1.5 text-left font-medium text-[#7c757c]">VAP</th>
                                        <th className="px-2.5 py-1.5 text-left font-medium text-[#7c757c]">Renove</th>
                                        <th className="px-2.5 py-1.5 text-left font-medium text-[#7c757c]">TV</th>
                                        <th className="px-2.5 py-1.5 text-left font-medium text-[#7c757c]">Activo desde</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {c.lineas.map((l: any, i: number) => (
                                        <tr key={i} className="border-t border-[#f0f0f8] hover:bg-[#f5ebf3]/30">
                                          <td className="px-2.5 py-1.5 font-mono font-medium">{l.numero || 'N/A'}</td>
                                          <td className="px-2.5 py-1.5">
                                            {l.es_cima ? <span className="text-emerald-600 font-medium">SI</span> : 'NO'}
                                          </td>
                                          <td className="px-2.5 py-1.5">
                                            <div className="flex flex-wrap gap-0.5">
                                              <span className={`rounded px-1 text-[9px] ${l.estado?.hotline ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>Hotline</span>
                                              <span className={`rounded px-1 text-[9px] ${l.estado?.suspendida ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>Suspendida</span>
                                              <span className={`rounded px-1 text-[9px] ${l.estado?.impago ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>Impago</span>
                                              <span className={`rounded px-1 text-[9px] ${l.estado?.fraude ? 'bg-red-200 text-red-800' : 'bg-gray-100 text-gray-400'}`}>Fraude</span>
                                            </div>
                                          </td>
                                          <td className="px-2.5 py-1.5">{l.consumo || '—'}</td>
                                          <td className="px-2.5 py-1.5">{l.permanencia || '—'}</td>
                                          <td className="px-2.5 py-1.5">{l.vap || '—'}</td>
                                          <td className="px-2.5 py-1.5">
                                            {l.tiene_renove ? (
                                              <span className="text-blue-600" title={l.variante_renove}>
                                                {l.variante_renove && l.variante_renove !== 'N/A'
                                                  ? l.variante_renove.length > 25 ? l.variante_renove.slice(0, 22) + '...' : l.variante_renove
                                                  : 'SI'}
                                              </span>
                                            ) : 'NO'}
                                          </td>
                                          <td className="px-2.5 py-1.5">{l.tiene_tv ? 'SI' : 'NO'}</td>
                                          <td className="px-2.5 py-1.5">{l.activo_desde || '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Si es no_cliente */}
                            {c.estado === 'no_cliente' && (
                              <p className="text-xs text-red-500 flex items-center gap-1">
                                <AlertTriangle size={12} /> No es cliente de Orange
                              </p>
                            )}

                            {/* Cambios detectados */}
                            {deteccionesCache[c.id_cliente] && deteccionesCache[c.id_cliente].length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-[#1a1030] mb-2 flex items-center gap-1">
                                  <TrendingUp size={12} className="text-[#0a6ea9]" />
                                  Cambios detectados ({deteccionesCache[c.id_cliente].length})
                                </h4>
                                <div className="flex flex-wrap gap-1">
                                  {deteccionesCache[c.id_cliente].map((d: any, i: number) => (
                                    <CambioBadge key={i} deteccion={d} />
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Timeline */}
                            {timelineCache[c.id_cliente] && timelineCache[c.id_cliente].length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-[#1a1030] mb-2">📋 Historial</h4>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                  {timelineCache[c.id_cliente].slice(0, 15).map((h: any, i: number) => (
                                    <div key={i} className="flex items-start gap-2 text-[10px]">
                                      <span className="text-[#b8b0b8] whitespace-nowrap">
                                        {h.created_at ? new Date(h.created_at).toLocaleString('es-PE') : '—'}
                                      </span>
                                      <span className={`rounded px-1.5 py-0.5 text-[8px] font-medium ${
                                        h.tipo === 'extraccion' ? 'bg-purple-100 text-purple-700' :
                                        h.tipo === 'llamada' ? 'bg-blue-100 text-blue-700' :
                                        h.tipo === 'asignacion' ? 'bg-emerald-100 text-emerald-700' :
                                        'bg-gray-100 text-gray-600'
                                      }`}>{h.tipo}</span>
                                      <span className="text-[#7c757c]">{h.descripcion}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#7c757c]">Mostrar</span>
            <select value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1); }}
              className="border border-[#e0e0f0] rounded-lg px-2 py-1 text-xs bg-white">
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-xs text-[#7c757c]">de {filtered.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="btn-outline text-xs px-3 py-1 disabled:opacity-30">Anterior</button>
            <span className="text-xs text-[#7c757c] px-2">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="btn-outline text-xs px-3 py-1 disabled:opacity-30">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CambioBadge({ deteccion }: { deteccion: any }) {
  const labels: Record<string, { text: string; color: string; icon: any }> = {
    linea_nueva: { text: 'Nueva línea', color: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: Smartphone },
    linea_eliminada: { text: 'Línea dada de baja', color: 'border-red-200 bg-red-50 text-red-700', icon: PhoneOff },
    renove_nuevo: { text: 'Nuevo Renove', color: 'border-blue-200 bg-blue-50 text-blue-700', icon: Gift },
    renove_cambio: { text: 'Cambió Renove', color: 'border-blue-200 bg-blue-50 text-blue-700', icon: Gift },
    permanencia_vencida: { text: 'Permanencia venció', color: 'border-amber-200 bg-amber-50 text-amber-700', icon: Clock },
    permanencia_cambio: { text: 'Cambió permanencia', color: 'border-amber-200 bg-amber-50 text-amber-700', icon: Clock },
    consumo_cambio: { text: 'Cambió consumo', color: 'border-indigo-200 bg-indigo-50 text-indigo-700', icon: TrendingUp },
    estado_cambio: { text: 'Cambió estado', color: 'border-orange-200 bg-orange-50 text-orange-700', icon: AlertTriangle },
    cima_nuevo: { text: 'Nuevo CIMA', color: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: Star },
    cima_perdido: { text: 'Perdió CIMA', color: 'border-red-200 bg-red-50 text-red-700', icon: StarOff },
    tv_nuevo: { text: 'Nuevo TV', color: 'border-purple-200 bg-purple-50 text-purple-700', icon: Tv },
    tv_perdido: { text: 'Perdió TV', color: 'border-gray-200 bg-gray-50 text-gray-600', icon: Tv },
    cliente_recuperado: { text: 'Cliente volvió', color: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: UserPlus },
    cliente_perdido: { text: 'Cliente se fue', color: 'border-red-200 bg-red-50 text-red-700', icon: UserMinus },
    paquete_cambio: { text: 'Cambió paquete', color: 'border-slate-200 bg-slate-50 text-slate-700', icon: Package },
  };
  const info = labels[deteccion.tipo] || { text: deteccion.tipo, color: 'border-gray-200 bg-gray-50 text-gray-600', icon: AlertTriangle };
  const Icon = info.icon;
  return (
    <div className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-medium border ${info.color}`}
         title={deteccion.linea_numero ? `Línea ${deteccion.linea_numero}: ${deteccion.valor_anterior || ''} → ${deteccion.valor_nuevo || ''}` : (deteccion.valor_nuevo || '')}>
      <Icon size={10} />
      {info.text}
      {deteccion.linea_numero && <span className="font-mono opacity-70">{deteccion.linea_numero.slice(-4)}</span>}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700', blue: 'bg-blue-50 text-blue-700',
    gray: 'bg-gray-100 text-gray-600', slate: 'bg-slate-50 text-slate-600',
    purple: 'bg-purple-50 text-purple-700',
  };
  return (
    <div className={`rounded-lg px-3 py-2 text-center ${colors[color] || colors.gray}`}>
      <p className="text-sm font-bold">{value || 'N/A'}</p>
      <p className="text-[9px] font-medium">{label}</p>
    </div>
  );
}
