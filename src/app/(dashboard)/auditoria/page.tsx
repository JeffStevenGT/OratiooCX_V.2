/**
 * app/(dashboard)/auditoria/page.tsx — Registro de actividad del sistema
 */

'use client';

import { useState, useEffect } from 'react';
import { Shield, Clock, User, FileText, Phone, Loader2, Search, Calendar, Filter, Eye } from 'lucide-react';

const PAGE_SIZES = [10, 25, 50, 100];
import { TableSkeleton } from '@/components/shared/Skeleton';
import { toast } from '@/components/shared/Toast';

type Evento = { id: number; id_cliente: string; tipo: string; descripcion: string; datos: any; created_at: string; asesor_nombre: string };

export default function AuditoriaPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState(new Date(Date.now() - 86400000).toISOString().split('T')[0]);
  const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0]);
  const [tipo, setTipo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ desde, hasta });
    if (tipo) params.set('tipo', tipo);
    fetch(`/api/auditoria?${params}`).then(r => r.json()).then(data => {
      setEventos(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => { toast.error('Error al cargar eventos de auditoría'); setLoading(false); });
  }, [desde, hasta, tipo]);

  useEffect(() => { setPage(1); }, [search, tipo]);

  const filtered = eventos.filter(e => {
    if (!search) return true;
    return e.id_cliente.toLowerCase().includes(search.toLowerCase()) ||
           e.descripcion.toLowerCase().includes(search.toLowerCase()) ||
           e.asesor_nombre?.toLowerCase().includes(search.toLowerCase());
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const tipoIcon = (t: string) => {
    if (t === 'llamada') return <Phone size={12} className="text-blue-500" />;
    if (t === 'tipificacion') return <FileText size={12} className="text-purple-500" />;
    if (t === 'asignacion') return <User size={12} className="text-emerald-500" />;
    if (t === 'liberacion') return <Clock size={12} className="text-red-500" />;
    return <Eye size={12} className="text-gray-400" />;
  };

  const TIPOS = ['llamada', 'tipificacion', 'asignacion', 'liberacion', 'extraccion'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Shield size={22} className="text-[#0a6ea9]" />Auditoría</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Registro de toda la actividad del sistema</p>
      </div>

      {/* Filtros */}
      <div className="card-sm flex items-center gap-3 flex-wrap">
        <Calendar size={14} className="text-gray-500 dark:text-gray-400" />
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-xs" />
        <span className="text-xs text-gray-400 dark:text-gray-500">→</span>
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-xs" />
        <Filter size={14} className="text-gray-500 dark:text-gray-400 ml-2" />
        <select value={tipo} onChange={e => setTipo(e.target.value)} className="border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-xs bg-white">
          <option value="">Todos los eventos</option>
          {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..." className="border border-gray-200 dark:border-gray-600 rounded-lg pl-7 pr-2.5 py-1.5 text-xs w-44 bg-white" />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">{filtered.length} eventos</span>
      </div>

      {/* Timeline */}
      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <TableSkeleton rows={10} cols={6} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16"><Clock size={48} className="text-gray-400 dark:text-gray-500 mx-auto mb-3" /><p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Sin eventos en este período</p><p className="text-xs text-gray-400 dark:text-gray-500">Ajusta los filtros de fecha o tipo para ver más resultados</p></div>
        ) : (
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <th className="table-header px-3 py-2 text-left w-8"></th>
                  <th className="table-header px-3 py-2 text-left">Fecha / Hora</th>
                  <th className="table-header px-3 py-2 text-left">Tipo</th>
                  <th className="table-header px-3 py-2 text-left">Cliente</th>
                  <th className="table-header px-3 py-2 text-left">Asesor</th>
                  <th className="table-header px-3 py-2 text-left">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(e => (
                  <tr key={e.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-800 text-xs">
                    <td className="py-2 px-3">{tipoIcon(e.tipo)}</td>
                    <td className="py-2 px-3 text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString('es-PE')}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        e.tipo === 'llamada' ? 'bg-blue-100 text-blue-700' :
                        e.tipo === 'tipificacion' ? 'bg-purple-100 text-purple-700' :
                        e.tipo === 'asignacion' ? 'bg-emerald-100 text-emerald-700' :
                        e.tipo === 'liberacion' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{e.tipo}</span>
                    </td>
                    <td className="py-2 px-3 font-mono">{e.id_cliente}</td>
                    <td className="py-2 px-3">{e.asesor_nombre || '—'}</td>
                    <td className="py-2 px-3 max-w-[300px] truncate">{e.descripcion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2">
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
              <span className="text-xs text-gray-500 dark:text-gray-400 px-2">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="btn-outline text-xs px-3 py-1 disabled:opacity-30">Siguiente</button>
            </div>
          </div>
        )}
      </div>
      {/* ── Info ── */}
      <div className="mt-8 card-sm bg-gray-50 dark:bg-gray-800 dark:bg-[#1e1a2a] border-dashed border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a]">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">💡 ¿Cómo funciona?</h3>
        <ul className="space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
          <li>· Registro completo de acciones en el sistema: asignaciones, extracciones, tipificaciones. Filtra por tipo y fecha.</li>
        </ul>
      </div>
    </div>
  );
}
