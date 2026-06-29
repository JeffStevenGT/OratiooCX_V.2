/**
 * app/(dashboard)/clientes/page.tsx — Tabla de Clientes (estilo proyecto viejo)
 * Filas expandibles con líneas agrupadas por paquete, cards de línea con campañas.
 */

'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search, Loader2, RefreshCw, ArrowUpDown, ChevronDown, ChevronUp, ChevronRight,
  Download, FileSpreadsheet, Users, Building, User, Smartphone, PhoneOff, Gift,
  Clock, TrendingUp, AlertTriangle, Star, StarOff, Tv,
  UserPlus, UserMinus, Package, Phone, FileText,
} from 'lucide-react';

type Cliente = {
  id_cliente: string; dni: string; tipo_documento: string; nombre: string;
  tipo_persona: string; linea_principal: string; paquete: string;
  cima: string; tiene_renove: string; renove_variante: string;
  fecha: string; hora: string; estado: string;
  lineas: any[]; header: any; cima_global: boolean;
  whatsapp_opt_in?: boolean; whatsapp_numero?: string; alertas_fidelizacion?: boolean;
};

import Skeleton, { TableSkeleton } from '@/components/shared/Skeleton';
import Tooltip from '@/components/shared/Tooltip';
import { toast } from '@/components/shared/Toast';

const PAGE_SIZES = [10, 25, 50, 100];

const VARIANTES = [
  { key: 'maximo', label: 'Máx descuento', text: 'Renove mixto al mejor precio con máximo descuento', color: 'emerald' },
  { key: 'con_descuento', label: 'Con descuento', text: 'Renove mixto al mejor precio con descuento', color: 'blue' },
  { key: 'mejor_precio', label: 'Mejor precio', text: 'Renove mixto al mejor precio', color: 'amber' },
  { key: 'renove_mixto', label: 'Renove mixto', text: 'Renove mixto', color: 'slate' },
];

const VARIANTES_MENORES = [
  { key: 'multidispositivo', label: 'Multidispositivo' },
  { key: 'otros', label: 'Otros' },
];

const RENOVE_VALIOSOS = VARIANTES.map(v => v.text);

export default function ClientesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [sortKey, setSortKey] = useState<string | null>(searchParams.get('sort') || null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>((searchParams.get('dir') as 'asc' | 'desc') || 'asc');
  const [cimaFilter, setCimaFilter] = useState<string | null>(searchParams.get('cima') || null);
  const [renoveFilter, setRenoveFilter] = useState<string | null>(searchParams.get('renove') || null);
  const [variantesActivas, setVariantesActivas] = useState<string[]>(searchParams.get('vars')?.split(',').filter(Boolean) || []);
  const [tagsActivas, setTagsActivas] = useState<string[]>(searchParams.get('tags')?.split(',').filter(Boolean) || []);
  const [minLineasFilter, setMinLineasFilter] = useState(Number(searchParams.get('minL') || '1'));
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('to') || '');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [editingTipo, setEditingTipo] = useState<string | null>(null);
  const [deteccionesCache, setDeteccionesCache] = useState<Record<string, any[]>>({});
  const [timelineCache, setTimelineCache] = useState<Record<string, any[]>>({});
  const [loadingDetecciones, setLoadingDetecciones] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [hasSearched, setHasSearched] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchClientes = async () => {
    if (!dateFrom && !dateTo) {
      toast.error('Selecciona al menos una fecha para buscar');
      return;
    }
    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      // Sin page/limit: carga todos los del rango para que filtros funcionen
      params.set('limit', '50000');
      const qs = params.toString();
      const res = await fetch(`/api/clientes?${qs}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Error al cargar');
      const json = await res.json();
      const data = json.data || [];
      setClientes(data);
      setTotal(json.total || data.length);
      setTotalPages(Math.ceil((json.total || data.length) / pageSize));
      setPage(1);
    } catch {
      toast.error('Error al cargar clientes');
    }
    setLoading(false);
  };

  // Solo carga al hacer clic en Buscar (no en mount)

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (cimaFilter) params.set('cima', cimaFilter);
    if (renoveFilter) params.set('renove', renoveFilter);
    if (variantesActivas.length > 0) params.set('vars', variantesActivas.join(','));
    if (tagsActivas.length > 0) params.set('tags', tagsActivas.join(','));
    if (minLineasFilter > 1) params.set('minL', String(minLineasFilter));
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    if (sortKey) params.set('sort', sortKey);
    if (sortDir !== 'asc') params.set('dir', sortDir);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }, [search, cimaFilter, renoveFilter, variantesActivas, dateFrom, dateTo, sortKey, sortDir, router]);

  useEffect(() => { setPage(1); }, [search, cimaFilter, renoveFilter, variantesActivas, tagsActivas, minLineasFilter, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    let result = [...clientes];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(c =>
        c.dni?.toLowerCase().includes(q) ||
        c.nombre?.toLowerCase().includes(q) ||
        c.linea_principal?.toLowerCase().includes(q) ||
        c.lineas?.some((l: any) => (l.numero || '').toLowerCase().includes(q))
      );
    }
    if (cimaFilter) result = result.filter(c => c.cima === cimaFilter);
    // Renove: solo variantes valiosas (excluye Multidispositivo y otros)
    if (renoveFilter === 'SI') {
      result = result.filter(c => c.lineas?.some((l: any) => l.tiene_renove && RENOVE_VALIOSOS.includes(l.variante_renove)));
    } else if (renoveFilter === 'NO') {
      result = result.filter(c => !c.lineas?.some((l: any) => l.tiene_renove && RENOVE_VALIOSOS.includes(l.variante_renove)));
    }
    if (variantesActivas.length > 0) {
      result = result.filter(c =>
        variantesActivas.some(vk => {
          const v = VARIANTES.find(x => x.key === vk);
          return v && c.lineas?.some((l: any) => l.variante_renove === v.text);
        })
      );
    }
    // Tags / Otros
    if (tagsActivas.length > 0) {
      result = result.filter(c =>
        tagsActivas.some(tk => {
          if (tk === 'multidispositivo') return c.lineas?.some((l: any) => l.variante_renove?.toLowerCase().includes('multidispositivo'));
          if (tk === 'otros') return c.lineas?.some((l: any) => l.variante_renove && l.variante_renove !== 'N/A' && ![...RENOVE_VALIOSOS, 'Renove Multidispositivo'].includes(l.variante_renove));
          return false;
        })
      );
    }
    // Min lineas CIMA+Renove valioso
    if (minLineasFilter > 1) {
      result = result.filter(c => {
        let count = 0;
        for (const l of (c.lineas || [])) {
          if (l.es_cima && l.tiene_renove && RENOVE_VALIOSOS.includes(l.variante_renove)) count++;
        }
        return count >= minLineasFilter;
      });
    }
    // date filter handled server-side via ultima_extraccion (timezone-correct)
    if (sortKey) {
      result.sort((a: any, b: any) => {
        const av = a[sortKey] || ''; const bv = b[sortKey] || '';
        return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    }
    return result;
  }, [clientes, search, cimaFilter, renoveFilter, variantesActivas, tagsActivas, minLineasFilter, dateFrom, dateTo, sortKey, sortDir]);

  // Paginacion client-side: los filtros buscan en todos los datos cargados
  const totalPagesLocal = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const clearFilters = () => {
    setSearch('');
    setCimaFilter(null);
    setRenoveFilter(null);
    setVariantesActivas([]);
    setTagsActivas([]);
    setMinLineasFilter(1);
    setSortKey(null);
    setSortDir('asc');
    setPage(1);
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const updateTipo = async (id: string, tipo: string) => {
    try {
      await fetch(`/api/clientes/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo_persona: tipo }),
      });
      setClientes(prev => prev.map(c => c.id_cliente === id ? { ...c, tipo_persona: tipo } : c));
      setEditingTipo(null);
      toast.success(`Tipo cambiado`);
    } catch { toast.error('Error al actualizar tipo'); }
  };

  const exportCSV = () => {
    const headers = ['DNI', 'Nombre', 'CIMA', 'Línea Principal', 'Paquete', 'Renove', 'Variante', 'Fecha', 'Hora'];
    const rows = filtered.map(c => [
      c.dni, c.nombre, c.cima, c.linea_principal, c.paquete,
      c.tiene_renove, c.renove_variante, c.fecha, c.hora,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `clientes_${dateFrom || 'todo'}_${dateTo || 'todo'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    window.open(`/api/clientes/export?${params.toString()}`, '_blank');
  };

  const SortHeader = ({ label, sk }: { label: string; sk: string }) => (
    <th className="table-header px-3 py-2.5 cursor-pointer hover:text-gray-900 dark:text-white select-none" onClick={() => toggleSort(sk)}>
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

  // ── Helpers para las líneas ──
  const todasLasLineas = (c: Cliente) => {
    return (c.lineas || []).map((l: any) => ({
      numero: l.numero || 'N/A',
      paquete: l.paquete || c.paquete || 'N/A',
      producto: l.producto || 'N/A',
      es_cima: l.es_cima || false,
      tiene_renove: l.tiene_renove || false,
      variante_renove: l.variante_renove || 'N/A',
      tiene_tv: l.tiene_tv || false,
      es_principal: l.es_principal || false,
      activo_desde: l.activo_desde || 'N/A',
      estado_linea: l.estado_detallado || [],
      estado_linea_resumen: l.estado_linea_resumen || 'N/A',
      permanencia: l.permanencia || 'N/A',
      permanencia_fecha: l.permanencia_fecha || '',
      consumo: l.consumo || 'N/A',
      venta_plazos: l.venta_plazos || 'N/A',
      campanas_extra: l.campanas_extra || [],
      etiquetas: l.etiquetas || [],
    }));
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Users size={22} className="text-[#0a6ea9]" />Clientes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{filtered.length} resultados</p>
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
            <FileSpreadsheet size={12} /> Excel ({filtered.length})
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input placeholder="Buscar DNI, nombre o línea..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 dark:border-gray-600 rounded-lg pl-8 pr-3 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-[#0a6ea9]/30" />
        </div>
        <span
          onClick={() => setCimaFilter(cimaFilter === 'SI' ? null : 'SI')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer select-none transition-all ${
            cimaFilter === 'SI'
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
          }`}>CIMA</span>
        <span
          onClick={() => setRenoveFilter(renoveFilter === 'SI' ? null : 'SI')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer select-none transition-all ${
            renoveFilter === 'SI'
              ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
          }`}>Renove</span>
        <span className="text-xs text-gray-400 font-medium">Variantes:</span>
        <div className="flex gap-1 flex-wrap">
          {VARIANTES.map(v => {
            const activa = variantesActivas.includes(v.key);
            const colorMap: Record<string, string> = {
              emerald: 'border-emerald-300 text-emerald-700 bg-emerald-100',
              blue: 'border-blue-300 text-blue-700 bg-blue-100',
              amber: 'border-amber-300 text-amber-700 bg-amber-100',
              slate: 'border-slate-300 text-slate-700 bg-slate-100',
            };
            return (
              <button key={v.key} onClick={() => setVariantesActivas(prev =>
                prev.includes(v.key) ? prev.filter(x => x !== v.key) : [...prev, v.key]
              )}
                className={`text-[10px] px-2 py-1 rounded-full border transition-colors font-medium ${
                  activa ? colorMap[v.color] || colorMap.slate : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}>{activa ? '✓' : '○'} {v.label}</button>
            );
          })}
        </div>
        <span className="text-gray-400 text-xs">|</span>
        <span className="text-xs text-gray-400 font-medium">Otros:</span>
        <div className="flex gap-1">
          {VARIANTES_MENORES.map(v => {
            const activa = tagsActivas.includes(v.key);
            return (
              <button key={v.key} onClick={() => setTagsActivas(prev =>
                prev.includes(v.key) ? prev.filter(x => x !== v.key) : [...prev, v.key]
              )}
                className={`text-[10px] px-2 py-1 rounded-full border transition-colors font-medium ${
                  activa ? 'border-slate-300 text-slate-700 bg-slate-100' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}>{activa ? '✓' : '○'} {v.label}</button>
            );
          })}
        </div>
        <span className="text-gray-400 text-xs">|</span>
        <span className="text-xs text-gray-400 font-medium">Mín líneas:</span>
        <select value={minLineasFilter} onChange={e => setMinLineasFilter(Number(e.target.value))}
          className="border border-gray-200 dark:border-gray-600 rounded-full px-2.5 py-1.5 text-[11px] bg-white">
          {[1, 2, 3, 4, 5, 10].map(n => (<option key={n} value={n}>{n}+</option>))}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-xs" />
        <span className="text-xs text-gray-500 dark:text-gray-400">a</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-xs" />
        <button onClick={fetchClientes}
          className="px-3 py-1.5 bg-[#0a6ea9] text-white rounded-lg text-xs font-medium hover:bg-[#085d8f] whitespace-nowrap">
          Buscar
        </button>
        <button onClick={clearFilters}
          className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-50 hover:text-gray-700 whitespace-nowrap">
          Limpiar
        </button>
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <TableSkeleton rows={pageSize} cols={9} />
        ) : paged.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Users size={48} className="text-gray-400 dark:text-gray-500 mx-auto mb-3" />
            {hasSearched ? (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">No se encontraron clientes</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Ajusta los filtros para ver más resultados</p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Selecciona un rango de fechas</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">y pulsa Buscar para ver los clientes</p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <th className="w-8"></th>
                  <SortHeader label="DNI" sk="dni" />
                  <SortHeader label="Nombre" sk="nombre" />
                  <th className="table-header px-3 py-2.5 cursor-pointer hover:text-gray-900 dark:text-white select-none" onClick={() => toggleSort('cima')}>
                    <div className="flex items-center gap-1">CIMA{sortKey === 'cima' ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={11} className="opacity-30" />}</div>
                  </th>
                  <SortHeader label="Líneas" sk="linea_principal" />
                  <SortHeader label="Paquete" sk="paquete" />
                  <SortHeader label="Renove" sk="tiene_renove" />
                  <th className="table-header px-3 py-2.5 cursor-pointer hover:text-gray-900 dark:text-white select-none" onClick={() => toggleSort('renove_variante')}>
                    <div className="flex items-center gap-1">Variante{sortKey === 'renove_variante' ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={11} className="opacity-30" />}</div>
                  </th>
                  <SortHeader label="Fecha" sk="fecha" />
                  <SortHeader label="Hora" sk="hora" />
                </tr>
              </thead>
              <tbody>
                {paged.map(c => {
                  const lineas = todasLasLineas(c);
                  const isOpen = expandido === c.id_cliente;
                  return (
                    <Fragment key={c.id_cliente}>
                      {/* ── FILA PRINCIPAL ── */}
                      <tr onClick={async () => {
                        const nuevo = isOpen ? null : c.id_cliente;
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
                        className={`border-b border-[#e8dce6] hover:bg-[#f5ebf3]/50 cursor-pointer transition-colors ${isOpen ? 'bg-[#f5ebf3]/30' : ''}`}>
                        <td className="py-2.5 px-1">
                          <button className="p-0.5 rounded hover:bg-[#e8dce6] transition-colors">
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-xs font-mono font-medium">{c.dni}</td>
                        <td className="py-2.5 px-3 text-xs max-w-[180px] truncate font-medium" title={c.nombre}>
                          {c.estado === 'no_cliente' ? <span className="text-red-600 font-semibold">NO ES CLIENTE</span> : (c.nombre || '-')}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${
                            c.cima === 'SI' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-white text-[#1a1030] border-[#e8dce6]'
                          }`}>{c.cima === 'SI' ? 'CIMA' : 'NO'}</span>
                        </td>
                        <td className="py-2.5 px-3 text-xs font-mono">
                          {(() => {
                            const nums = lineas.map(l => l.numero).filter(Boolean);
                            if (nums.length === 0) return c.linea_principal || '-';
                            if (nums.length === 1) return nums[0];
                            return <span title={nums.join(', ')}>{nums[0]} <span className="text-[#7c757c]">+{nums.length - 1}</span></span>;
                          })()}
                        </td>
                        <td className="py-2.5 px-3 text-xs max-w-[120px] truncate" title={c.paquete}>{c.paquete}</td>
                        <td className="py-2.5 px-3">
                          {c.renove_variante && c.renove_variante !== 'N/A' ? (
                            <span className="text-[#0a6ea9] font-medium text-xs">{c.renove_variante}</span>
                          ) : <span className="text-[#7c757c]">-</span>}
                        </td>
                        <td className="py-2.5 px-3 text-xs max-w-[160px] truncate" title={c.renove_variante}>{c.renove_variante}</td>
                        <td className="py-2.5 px-3 text-xs text-gray-500 dark:text-gray-400">{c.fecha}</td>
                        <td className="py-2.5 px-3 text-xs text-gray-500 dark:text-gray-400">{c.hora}</td>
                      </tr>

                      {/* ── FILA EXPANDIDA ── */}
                      {isOpen && (
                        <tr key={`exp-${c.id_cliente}`}>
                          <td colSpan={10} className="p-0">
                            <div className="bg-[#f5ebf3]/30 border-b border-[#e8dce6] px-6 py-4 space-y-4">

                              {/* ── DATOS DEL CLIENTE ── */}
                              <div className="card !bg-white/60">
                                <h4 className="text-sm font-semibold text-[#1a1030] mb-3 flex items-center gap-2">
                                  <FileText size={14} className="text-[#0a6ea9]" /> Datos del cliente
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                                  <div><span className="text-[#7c757c]">Nombre:</span><p className="text-[#1a1030]">{c.nombre || '-'}</p></div>
                                  <div><span className="text-[#7c757c]">DNI:</span><p className="text-[#1a1030] font-mono">{c.dni}</p></div>
                                  <div className="col-span-2"><span className="text-[#7c757c]">Dirección:</span><p className="text-[#1a1030]">{c.header?.direccion || '-'}</p></div>
                                  <div><span className="text-[#7c757c]">CIMA global:</span>
                                    <span className={c.cima === 'SI' ? 'text-emerald-700 font-medium ml-1' : 'text-[#7c757c] ml-1'}>{c.cima === 'SI' ? 'SÍ' : 'NO'}</span>
                                  </div>
                                  <div><span className="text-[#7c757c]">Renove Mixto:</span>
                                    <span className={c.tiene_renove === 'SI' ? 'text-emerald-700 font-medium ml-1' : 'text-[#7c757c] ml-1'}>{c.tiene_renove === 'SI' ? 'SÍ' : 'NO'}</span>
                                  </div>
                                  {c.renove_variante && c.renove_variante !== 'N/A' && (
                                    <div className="col-span-2"><span className="text-[#7c757c]">Mejor variante:</span><p className="text-[#0a6ea9] font-medium">{c.renove_variante}</p></div>
                                  )}
                                  {/* Tipo persona editable */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-[#7c757c]">Tipo:</span>
                                    {editingTipo === c.id_cliente ? (
                                      <select value={c.tipo_persona} onChange={e => updateTipo(c.id_cliente, e.target.value)}
                                        onBlur={() => setEditingTipo(null)} autoFocus
                                        className="border border-gray-200 rounded-lg px-2 py-0.5 text-[10px] bg-white">
                                        <option value="natural">Natural</option>
                                        <option value="autonomo">Autónomo</option>
                                        <option value="empresa">Empresa</option>
                                      </select>
                                    ) : (
                                      <button onClick={(e) => { e.stopPropagation(); setEditingTipo(c.id_cliente); }} className="cursor-pointer">
                                        <TipoBadge tipo={c.tipo_persona} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* ── LÍNEAS (agrupadas por paquete) ── */}
                              <h4 className="text-sm font-semibold text-[#1a1030] flex items-center gap-2">
                                <Phone size={14} className="text-[#0a6ea9]" /> Líneas ({lineas.length})
                              </h4>

                              {(() => {
                                // Agrupar por paquete_tariff
                                const grupos: Record<string, any[]> = {};
                                for (const l of lineas) {
                                  const pkg = l.paquete || 'Sin paquete';
                                  if (!grupos[pkg]) grupos[pkg] = [];
                                  grupos[pkg].push(l);
                                }
                                const paquetes = Object.keys(grupos);
                                return (
                                  <div className="space-y-5">
                                    {paquetes.map((pkg, gIdx) => (
                                      <div key={gIdx}>
                                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#0a6ea9]/30">
                                          <span className="text-xs font-bold text-[#0a6ea9] uppercase tracking-wider">📦 {pkg}</span>
                                          <span className="text-[10px] text-[#7c757c]">{grupos[pkg].length} {grupos[pkg].length === 1 ? 'línea' : 'líneas'}</span>
                                        </div>
                                        <div className="space-y-3">
                                          {grupos[pkg].map((l: any, idx: number) => (
                                            <div key={idx} className="bg-white/60 rounded-lg border border-[#e8dce6] overflow-hidden">
                                              {/* Cabecera de línea */}
                                              <div className="px-4 py-2.5 border-b border-[#e8dce6] flex items-center justify-between bg-[#faf8fa]">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-sm font-semibold text-[#1a1030] font-mono">{l.numero}</span>
                                                  <div className="flex gap-1">
                                                    {l.es_cima && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">CIMA</span>}
                                                    {l.tiene_renove && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Renove</span>}
                                                    {l.es_principal && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">Principal</span>}
                                                    {l.tiene_tv && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">TV</span>}
                                                  </div>
                                                </div>
                                                <span className="text-[10px] text-[#7c757c]">desde {l.activo_desde}</span>
                                              </div>
                                              {/* Cuerpo: 2 columnas */}
                                              <div className="flex flex-col lg:flex-row">
                                                {/* Izquierda: datos */}
                                                <div className="lg:w-[45%] p-4 border-r border-[#e8dce6]">
                                                  <p className="text-[11px] font-semibold text-[#1a1030] mb-2">{l.producto}</p>
                                                  <div className="space-y-1.5 text-[11px]">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                      <span className="text-[#7c757c]">Estado:</span>
                                                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${l.estado_linea_resumen === 'Activa' ? 'bg-emerald-50 text-emerald-700' : l.estado_linea_resumen !== 'N/A' ? 'bg-red-50 text-red-700' : 'text-[#7c757c]'}`}>
                                                        {l.estado_linea_resumen}
                                                      </span>
                                                      {l.estado_linea.filter((e: any) => e.activo).length > 0 && (
                                                        <div className="flex gap-0.5">
                                                          {l.estado_linea.filter((e: any) => e.activo).map((e: any, i: number) => (
                                                            <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">{e.texto}</span>
                                                          ))}
                                                        </div>
                                                      )}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                                      <div><span className="text-[#7c757c]">Permanencia:</span> <span className="text-[#1a1030]">{l.permanencia}</span></div>
                                                      <div><span className="text-[#7c757c]">Vence:</span> <span className="text-[#1a1030]">{l.permanencia_fecha || '-'}</span></div>
                                                      <div><span className="text-[#7c757c]">Consumo:</span> <span className="text-[#1a1030]">{l.consumo}</span></div>
                                                      <div><span className="text-[#7c757c]">Venta Plazos:</span> <span className="text-[#1a1030]">{l.venta_plazos}</span></div>
                                                    </div>
                                                    {l.variante_renove !== 'N/A' && (
                                                      <div className="pt-1"><span className="text-[#7c757c]">Renove:</span> <span className="text-[#0a6ea9] font-medium">{l.variante_renove}</span></div>
                                                    )}
                                                  </div>
                                                </div>
                                                {/* Derecha: campañas */}
                                                <div className="lg:w-[55%] p-4 bg-[#faf8fa]/50">
                                                  {l.campanas_extra && l.campanas_extra.length > 0 ? (
                                                    <div className="space-y-1.5">
                                                      {(() => {
                                                        const campGrupos: Record<string, string[]> = {};
                                                        for (const camp of l.campanas_extra) {
                                                          const tipo = camp.tipo || 'Otros';
                                                          if (!campGrupos[tipo]) campGrupos[tipo] = [];
                                                          campGrupos[tipo].push(camp.texto || camp);
                                                        }
                                                        return Object.entries(campGrupos).map(([tipo, textos], ci) => (
                                                          <div key={ci} className="text-[10px]">
                                                            <span className="font-semibold text-[#481162] uppercase text-[9px] tracking-wider">{tipo}</span>
                                                            {textos.map((txt: string, ti: number) => (
                                                              <p key={ti} className="text-[#7c757c] ml-1">{txt}</p>
                                                            ))}
                                                          </div>
                                                        ));
                                                      })()}
                                                    </div>
                                                  ) : (
                                                    <p className="text-[10px] text-[#7c757c] italic">Sin campañas</p>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}

                              {/* Si es no_cliente */}
                              {c.estado === 'no_cliente' && (
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                  <AlertTriangle size={12} /> No es cliente de Orange
                                </p>
                              )}

                              {/* Cambios detectados */}
                              {deteccionesCache[c.id_cliente] && deteccionesCache[c.id_cliente].length > 0 ? (
                                <div>
                                  <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1">
                                    <TrendingUp size={12} className="text-[#0a6ea9]" /> Cambios detectados ({deteccionesCache[c.id_cliente].length})
                                  </h4>
                                  <div className="flex flex-wrap gap-1">
                                    {deteccionesCache[c.id_cliente].map((d: any, i: number) => <CambioBadge key={i} deteccion={d} />)}
                                  </div>
                                </div>
                              ) : deteccionesCache[c.id_cliente] && deteccionesCache[c.id_cliente].length === 0 && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                                  <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                                    <TrendingUp size={12} /> <strong>Análisis inicial</strong> — {lineas.length} líneas registradas
                                  </p>
                                  <p className="text-[10px] text-emerald-600/70 mt-1">La próxima extracción detectará cambios reales.</p>
                                </div>
                              )}

                              {/* Timeline */}
                              {timelineCache[c.id_cliente] && timelineCache[c.id_cliente].length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-2">📋 Historial</h4>
                                  <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {timelineCache[c.id_cliente].slice(0, 15).map((h: any, i: number) => (
                                      <div key={i} className="flex items-start gap-2 text-[10px]">
                                        <span className="text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                          {h.created_at ? new Date(h.created_at).toLocaleString('es-PE') : '—'}
                                        </span>
                                        <span className={`rounded px-1.5 py-0.5 text-[8px] font-medium ${
                                          h.tipo === 'extraccion' ? 'bg-purple-100 text-purple-700' :
                                          h.tipo === 'llamada' ? 'bg-blue-100 text-blue-700' :
                                          h.tipo === 'asignacion' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                                        }`}>{h.tipo}</span>
                                        <span className="text-gray-500 dark:text-gray-400">{h.descripcion}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Reanalizar + WhatsApp */}
                              <div className="flex items-center gap-4 pt-2 border-t border-[#e8dce6]">
                                <button onClick={(e) => { e.stopPropagation(); fetch(`/api/clientes/reanalizar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_cliente: c.id_cliente }) }).then(() => { setExpandido(null); fetchClientes(); }); }}
                                  className="text-[10px] text-[#0a6ea9] hover:underline">
                                  🔄 Reanalizar con el bot
                                </button>
                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                  <span className="text-[10px] text-[#7c757c]">Alertas Fidelización</span>
                                  <button onClick={async () => {
                                    await fetch(`/api/clientes/${c.id_cliente}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alertas_fidelizacion: !c.alertas_fidelizacion }) });
                                    fetchClientes();
                                  }} className={`w-8 h-4 rounded-full transition-colors ${c.alertas_fidelizacion ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                    <div className={`w-3 h-3 bg-white rounded-full shadow transition-transform ${c.alertas_fidelizacion ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile card view */}
      {!loading && paged.length > 0 && (
        <div className="card !p-0 md:hidden">
          {paged.map(c => {
            const lineas = todasLasLineas(c);
            const nums = lineas.map(l => l.numero).filter(Boolean);
            return (
              <div key={c.id_cliente} className="border-b border-gray-200 dark:border-gray-700 last:border-0 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">{c.dni}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${c.cima === 'SI' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{c.cima === 'SI' ? 'CIMA' : 'NO CIMA'}</span>
                </div>
                <p className="text-sm text-gray-900 dark:text-white font-medium">{c.nombre}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div><span className="text-gray-400 dark:text-gray-500">Líneas:</span> <span className="text-gray-500 dark:text-gray-400">{nums.length > 1 ? `${nums[0]} +${nums.length-1}` : nums[0] || '-'}</span></div>
                  <div><span className="text-gray-400 dark:text-gray-500">Paquete:</span> <span className="text-gray-500 dark:text-gray-400">{c.paquete}</span></div>
                  <div><span className="text-gray-400 dark:text-gray-500">Renove:</span> <span className={c.tiene_renove === 'SI' ? 'text-blue-600 font-medium' : 'text-gray-500 dark:text-gray-400'}>{c.tiene_renove === 'SI' ? 'SI' : 'NO'}</span></div>
                  <div><span className="text-gray-400 dark:text-gray-500">Variante:</span> <span className="text-[10px] text-gray-500 dark:text-gray-400">{c.renove_variante?.slice(0, 25) || '—'}</span></div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
                  <span>{c.fecha} {c.hora}</span>
                  <TipoBadge tipo={c.tipo_persona} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPagesLocal > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Mostrar</span>
            <select value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1); }}
              className="border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-xs bg-white">
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-xs text-gray-500 dark:text-gray-400">de {filtered.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="btn-outline text-xs px-3 py-1 disabled:opacity-30">Anterior</button>
            <span className="text-xs text-gray-500 dark:text-gray-400 px-2">{page} / {totalPagesLocal}</span>
            <button onClick={() => setPage(p => Math.min(totalPagesLocal, p + 1))} disabled={page === totalPagesLocal}
              className="btn-outline text-xs px-3 py-1 disabled:opacity-30">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subcomponentes ──

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
      <Icon size={10} /> {info.text}
      {deteccion.linea_numero && <span className="font-mono opacity-70">{deteccion.linea_numero.slice(-4)}</span>}
    </div>
  );
}
