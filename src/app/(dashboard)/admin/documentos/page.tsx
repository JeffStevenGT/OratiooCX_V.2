/**
 * app/(dashboard)/admin/documentos/page.tsx — Subida de DNIs + Monitoreo BD VPS
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Upload, FileText, Loader2, CheckCircle2, AlertTriangle, Table2,
  List, RefreshCw, Database, Filter, Activity, PlayCircle, Phone, FileDigit
} from 'lucide-react';

const PAGE_SIZES = [10, 25, 50, 100];

type ColaDni = { id_cliente: string; estado: string; ultima_extraccion: string | null; updated_at: string | null };
type ColaResumen = Record<string, number>;
type ColaData = {
  resumen: ColaResumen;
  resumenDia: ColaResumen;
  total: number;
  procesadosHoy: number;
  listosReprocesar: number;
  dnis: ColaDni[];
};

const ESTADOS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  completado:   { label: 'Completados',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: '✅' },
  pendiente:    { label: 'Pendientes',    color: 'bg-amber-100 text-amber-700 border-amber-200',     icon: '⏳' },
  null:         { label: 'Por procesar',  color: 'bg-purple-100 text-purple-700 border-purple-200',  icon: '🆕' },
  sin_datos:    { label: 'Sin datos',     color: 'bg-slate-100 text-slate-600 border-slate-200',    icon: '📭' },
  no_cliente:   { label: 'No cliente',    color: 'bg-gray-100 text-gray-600 border-gray-200',       icon: '🚫' },
  no_cargable:  { label: 'No cargable',   color: 'bg-orange-100 text-orange-700 border-orange-200', icon: '⚠️' },
  error:        { label: 'Error',         color: 'bg-red-100 text-red-700 border-red-200',           icon: '❌' },
};

const ESTADOS_ORDEN = ['completado', 'pendiente', 'null', 'sin_datos', 'no_cliente', 'no_cargable', 'error'];

export default function DocumentosPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dnis, setDnis] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ status: string; text: string; detalle?: any } | null>(null);
  const [cola, setCola] = useState<ColaData | null>(null);
  const [loadingCola, setLoadingCola] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [mostrarHistorico, setMostrarHistorico] = useState(true);
  const [tipo, setTipo] = useState<'todos' | 'doc' | 'tel'>('todos');

  const isExcel = (name: string) => name.endsWith('.xlsx') || name.endsWith('.xls');

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setResult(null);

    if (isExcel(f.name)) {
      try {
        const XLSX = await import('xlsx');
        const buffer = await f.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        const rows: string[] = [];
        for (let r = range.s.r; r <= range.e.r; r++) {
          const cells: string[] = [];
          for (let c = range.s.c; c <= range.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            const cell = ws[addr];
            cells.push(cell ? String(cell.v ?? '').trim() : '');
          }
          rows.push(cells.join(' '));
        }
        const text = rows.join('\n');
        const found = new Set<string>();
        const re = /\b[A-Za-z]?\d{7,8}[A-Za-z]?\b/;
        for (const line of text.split('\n')) {
          const clean = line.trim().replace(/^"|"$/g, '');
          if (!clean || clean.startsWith('#')) continue;
          const match = clean.match(re);
          if (match && match[0].length >= 6) found.add(match[0].toUpperCase());
        }
        setDnis(Array.from(found));
      } catch {
        setDnis([]);
      }
    } else {
      const text = await f.text();
      const found = new Set<string>();
      const dniRe = /\b[A-Za-z]?\d{7,8}[A-Za-z]?\b/;
      const telRe = /\b[6789]\d{8}\b/;  // móvil (6,7) y fijo (8,9) español
      for (const line of text.split('\n')) {
        const clean = line.trim().replace(/^"|"$/g, '');
        if (!clean || clean.startsWith('#')) continue;
        const dniMatch = clean.match(dniRe);
        const telMatch = clean.match(telRe);
        if (dniMatch && dniMatch[0].length >= 6) {
          found.add(dniMatch[0].toUpperCase());
        } else if (telMatch) {
          found.add(telMatch[0]);
        }
      }
      setDnis(Array.from(found));
    }
  }, []);

  const fetchCola = useCallback(async () => {
    setLoadingCola(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      if (tipo !== 'todos') params.set('tipo', tipo);
      const qs = params.toString();
      const res = await fetch(`/api/documentos/cola${qs ? '?' + qs : ''}`);
      if (res.ok) setCola(await res.json());
    } catch { /* ignore */ }
    setLoadingCola(false);
  }, [dateFrom, dateTo, tipo]);

  useEffect(() => { fetchCola(); }, [fetchCola]);
  useEffect(() => { setPage(1); }, []);

  const handleUpload = async () => {
    if (!file || dnis.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/documentos/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setResult({
        status: 'ok',
        text: data.resumen || `${data.count || dnis.length} DNIs cargados.`,
        detalle: data,
      });
      setFile(null);
      fetchCola();
    } catch (err: any) {
      setResult({ status: 'error', text: err.message || 'Error al cargar los DNIs.' });
    } finally {
      setUploading(false);
    }
  };

  const resumen = cola?.resumen || {};
  const resumenDia = cola?.resumenDia || {};

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Database size={22} className="text-[#0a6ea9]" />
            Documentos — Monitoreo BD
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {cola ? `${cola.total.toLocaleString()} registros en Orange` : 'Cargando...'}
            {cola?.procesadosHoy ? ` · ${cola.procesadosHoy.toLocaleString()} procesados hoy` : ''}
          </p>
        </div>
        <button onClick={fetchCola} disabled={loadingCola}
          className="btn-outline flex items-center gap-1.5 text-xs px-3 py-1.5">
          <RefreshCw size={12} className={loadingCola ? 'animate-spin' : ''} /> Refrescar
        </button>
      </div>

      {/* ── Cards de todos los escenarios ── */}
      <div className={`grid grid-cols-4 md:grid-cols-7 gap-3 transition-opacity duration-150 ${loadingCola ? 'opacity-50' : ''}`}>
        {ESTADOS_ORDEN.map(estado => {
          const cfg = ESTADOS_CONFIG[estado];
          const count = mostrarHistorico ? (resumen[estado] || 0) : (resumenDia[estado] || 0);
          return (
            <div key={estado}
              className={`rounded-xl border px-3 py-3 text-center transition-all ${cfg.color} ${count > 0 ? 'shadow-sm' : 'opacity-60'}`}>
              <p className="text-2xl font-bold">{loadingCola ? '...' : count.toLocaleString()}</p>
              <p className="text-[10px] font-medium mt-0.5 flex items-center justify-center gap-1">
                <span>{cfg.icon}</span> {cfg.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── KPIs rápidos ── */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <Activity size={14} className="text-blue-600" />
          <span className="text-xs font-medium text-blue-700">
            Hoy: {cola?.procesadosHoy?.toLocaleString() || 0} procesados
          </span>
        </div>
        <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
          <PlayCircle size={14} className="text-purple-600" />
          <span className="text-xs font-medium text-purple-700">
            {cola?.listosReprocesar?.toLocaleString() || 0} listos para reprocesar
          </span>
        </div>
        <button
          onClick={() => setMostrarHistorico(!mostrarHistorico)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            mostrarHistorico
              ? 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              : 'bg-[#0a6ea9] border-[#0a6ea9] text-white'
          }`}>
          {mostrarHistorico ? '📊 Histórico' : '📅 Por fecha'}
        </button>
        <span className="text-gray-300">|</span>
        <button
          onClick={() => setTipo('todos')}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            tipo === 'todos' ? 'bg-[#0a6ea9] border-[#0a6ea9] text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}>
          <Database size={12} className="inline mr-1" />Todos
        </button>
        <button
          onClick={() => setTipo('doc')}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            tipo === 'doc' ? 'bg-[#0a6ea9] border-[#0a6ea9] text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}>
          <FileDigit size={12} className="inline mr-1" />Docs
        </button>
        <button
          onClick={() => setTipo('tel')}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            tipo === 'tel' ? 'bg-[#0a6ea9] border-[#0a6ea9] text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}>
          <Phone size={12} className="inline mr-1" />Teléfonos
        </button>
        {!mostrarHistorico && (
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1 text-xs" />
            <span className="text-xs text-gray-400">a</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1 text-xs" />
            <button onClick={fetchCola}
              className="px-3 py-1 bg-[#0a6ea9] text-white rounded-lg text-xs font-medium">
              <Filter size={12} className="inline mr-1" />Filtrar
            </button>
          </div>
        )}
      </div>

      {/* ── Dropzone ── */}
      <div
        onDrop={async (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) await handleFile(f); }}
        onDragOver={(e) => e.preventDefault()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          file ? 'border-emerald-300 bg-emerald-50' : 'border-[#e0e0f0] bg-white hover:border-[#0a6ea9]'
        }`}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input id="file-input" type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleFile(f); }} />
        {file ? (
          <div className="space-y-2">
            {isExcel(file.name)
              ? <Table2 size={36} className="text-emerald-500 mx-auto" />
              : <FileText size={36} className="text-emerald-500 mx-auto" />}
            <p className="text-[#1a1030] font-medium">{file.name}</p>
            <p className="text-sm text-[#7c757c]">
              {dnis.length > 0 ? `${dnis.length} números detectados` : 'Analizando...'}
            </p>
            <button onClick={(e) => { e.stopPropagation(); setFile(null); setDnis([]); setResult(null); }}
              className="text-xs text-[#7c757c] hover:text-red-500 underline">Cambiar archivo</button>
          </div>
        ) : (
          <>
            <Upload size={36} className="text-[#b8b0b8] mx-auto mb-3" />
            <p className="text-[#1a1030] font-medium">Arrastra un archivo aquí</p>
            <p className="text-sm text-[#7c757c] mt-1">.csv &nbsp;·&nbsp; .txt &nbsp;·&nbsp; .xlsx &nbsp;·&nbsp; .xls</p>
          </>
        )}
      </div>

      {/* ── Preview + Upload ── */}
      {dnis.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#1a1030]">{dnis.length} números detectados</h3>
            <div className="flex items-center gap-2">
              <button onClick={handleUpload} disabled={uploading}
                className="bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? 'Cargando...' : 'Cargar'}
              </button>
              <button onClick={() => { setFile(null); setDnis([]); setResult(null); }}
                className="border border-gray-200 text-gray-500 rounded-lg px-3 py-2 text-sm hover:bg-gray-50">Limpiar</button>
            </div>
          </div>

          {result && (
            <div className={`mb-3 px-3 py-2 rounded-lg text-xs border ${
              result.status === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                {result.status === 'ok' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                <span className="font-medium">{result.text}</span>
              </div>
              {result.detalle && (
                <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                  <div className="bg-white/50 rounded p-1.5">
                    <p className="text-lg font-bold">{result.detalle.nuevos || 0}</p>
                    <p className="text-[9px]">Nuevos</p>
                  </div>
                  <div className="bg-white/50 rounded p-1.5">
                    <p className="text-lg font-bold">{result.detalle.reabiertos || 0}</p>
                    <p className="text-[9px]">Reabiertos</p>
                  </div>
                  <div className="bg-white/50 rounded p-1.5">
                    <p className="text-lg font-bold">{result.detalle.ignorados || 0}</p>
                    <p className="text-[9px]">Ignorados</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
            {dnis.slice(0, 100).map((d) => (
              <span key={d} className="bg-[#f8f7fa] text-xs font-mono text-[#1a1030] px-2 py-1 rounded border border-[#e8dce6]">
                {d}
              </span>
            ))}
            {dnis.length > 100 && (
              <span className="text-xs text-[#7c757c] self-center">+{dnis.length - 100} más</span>
            )}
          </div>
        </div>
      )}

      {/* ── Últimos DNIs (tabla) ── */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <List size={16} className="text-[#0a6ea9]" />
            Últimos registros
          </h3>
          <span className="text-xs text-gray-400">{cola?.dnis?.length || 0} mostrados</span>
        </div>

        {cola ? (
          <>
            {(() => {
              const totalPages = Math.ceil((cola.dnis?.length || 0) / pageSize);
              const paged = (cola.dnis || []).slice((page - 1) * pageSize, page * pageSize);
              return paged.length > 0 ? (
                <>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="table-header px-3 py-2 text-left">ID Cliente</th>
                          <th className="table-header px-3 py-2 text-left">Estado</th>
                          <th className="table-header px-3 py-2 text-left">Última extracción</th>
                          <th className="table-header px-3 py-2 text-left">Actualizado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paged.map((d) => (
                          <tr key={d.id_cliente} className="border-b border-[#f0f0f8] hover:bg-[#f8f7fa]">
                            <td className="py-2 px-3 font-mono text-[11px]">{d.id_cliente}</td>
                            <td className="py-2 px-3">
                              <EstadoBadge estado={d.estado || 'null'} />
                            </td>
                            <td className="py-2 px-3 text-[#7c757c]">
                              {d.ultima_extraccion ? new Date(d.ultima_extraccion).toLocaleString('es-PE') : '—'}
                            </td>
                            <td className="py-2 px-3 text-[#7c757c]">
                              {d.updated_at ? new Date(d.updated_at).toLocaleString('es-PE') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#7c757c]">Mostrar</span>
                        <select value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1); }}
                          className="border border-[#e0e0f0] rounded-lg px-2 py-1 text-xs bg-white">
                          {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <span className="text-xs text-[#7c757c]">de {cola.dnis.length}</span>
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
                </>
              ) : (
                <div className="text-center py-8 text-xs text-gray-400">Sin registros para mostrar</div>
              );
            })()}
          </>
        ) : (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-[#b8b0b8]" />
          </div>
        )}
      </div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADOS_CONFIG[estado];
  if (!cfg) return (
    <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600">
      {estado}
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}
