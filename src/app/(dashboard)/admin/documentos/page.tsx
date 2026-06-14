/**
 * app/(dashboard)/admin/documentos/page.tsx — Subida de DNIs
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, AlertTriangle, Table2, Clock, List, RefreshCw } from 'lucide-react';

const PAGE_SIZES = [10, 25, 50, 100];

type ColaDni = { id_cliente: string; estado: string; ultima_extraccion: string | null; updated_at: string | null };
type ColaResumen = Record<string, number>;

export default function DocumentosPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dnis, setDnis] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ status: string; text: string; detalle?: any } | null>(null);
  const [cola, setCola] = useState<{ resumen: ColaResumen; dnis: ColaDni[] } | null>(null);
  const [loadingCola, setLoadingCola] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const isExcel = (name: string) => name.endsWith('.xlsx') || name.endsWith('.xls');

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setResult(null);

    // Previsualizar: parseamos client-side para mostrar DNIs rápido
    if (isExcel(f.name)) {
      // Excel → preview parcial con xlsx en cliente
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
      const re = /\b[A-Za-z]?\d{7,8}[A-Za-z]?\b/;
      for (const line of text.split('\n')) {
        const clean = line.trim().replace(/^"|"$/g, '');
        if (!clean || clean.startsWith('#')) continue;
        const match = clean.match(re);
        if (match && match[0].length >= 6) found.add(match[0].toUpperCase());
      }
      setDnis(Array.from(found));
    }
  }, []);

  const fetchCola = useCallback(async () => {
    setLoadingCola(true);
    try {
      const res = await fetch('/api/documentos/cola');
      if (res.ok) setCola(await res.json());
    } catch { /* ignore */ }
    setLoadingCola(false);
  }, []);

  useEffect(() => { fetchCola(); }, [fetchCola]);
  useEffect(() => { setPage(1); }, []);

  const handleUpload = async () => {
    if (!file || dnis.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/documentos/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Error');

      setResult({
        status: 'ok',
        text: data.resumen || `${data.count || dnis.length} DNIs cargados.`,
        detalle: data,
      });
      setFile(null);
      setDnis([]);
      fetchCola(); // refrescar cola
    } catch (err: any) {
      setResult({ status: 'error', text: err.message || 'Error al cargar los DNIs.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-[#1a1030]">Subida de Documentos</h1>
        <p className="text-sm text-[#7c757c] mt-1">
          Carga un archivo con DNIs para que la app los procese automáticamente.
        </p>
      </div>

      {/* Dropzone */}
      <div
        onDrop={async (e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) await handleFile(f);
        }}
        onDragOver={(e) => e.preventDefault()}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
          file ? 'border-emerald-300 bg-emerald-50' : 'border-[#e0e0f0] bg-white hover:border-[#0a6ea9]'
        }`}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".csv,.txt,.xlsx,.xls"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) await handleFile(f);
          }}
        />
        {file ? (
          <div className="space-y-2">
            {isExcel(file.name) ? (
              <Table2 size={40} className="text-emerald-500 mx-auto" />
            ) : (
              <FileText size={40} className="text-emerald-500 mx-auto" />
            )}
            <p className="text-[#1a1030] font-medium">{file.name}</p>
            <p className="text-sm text-[#7c757c]">
              {dnis.length > 0
                ? `${dnis.length} DNIs detectados`
                : 'Analizando...'}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                setDnis([]);
                setResult(null);
              }}
              className="text-xs text-[#7c757c] hover:text-red-500 underline"
            >
              Cambiar archivo
            </button>
          </div>
        ) : (
          <>
            <Upload size={40} className="text-[#b8b0b8] mx-auto mb-3" />
            <p className="text-[#1a1030] font-medium">
              Arrastra un archivo aquí
            </p>
            <p className="text-sm text-[#7c757c] mt-1">
              .csv &nbsp;·&nbsp; .txt &nbsp;·&nbsp; .xlsx &nbsp;·&nbsp; .xls
            </p>
            <p className="text-xs text-[#b8b0b8] mt-2">
              o haz clic para seleccionarlo
            </p>
          </>
        )}
      </div>

      {/* Preview */}
      {dnis.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#1a1030]">
              {dnis.length} DNIs detectados
            </h3>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Cargando...' : 'Cargar DNIs'}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div className={`mb-3 px-3 py-2 rounded-lg text-xs border ${
              result.status === 'ok'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
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
              <span
                key={d}
                className="bg-[#f8f7fa] text-xs font-mono text-[#1a1030] px-2 py-1 rounded border border-[#e8dce6]"
              >
                {d}
              </span>
            ))}
            {dnis.length > 100 && (
              <span className="text-xs text-[#7c757c] self-center">
                +{dnis.length - 100} más
              </span>
            )}
          </div>
        </div>
      )}

      {/* Cola de DNIs */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <List size={16} className="text-[#0a6ea9]" />
            Cola de DNIs — Proyecto Orange
          </h3>
          <button onClick={fetchCola} disabled={loadingCola}
            className="text-xs text-[#7c757c] hover:text-[#0a6ea9] flex items-center gap-1">
            <RefreshCw size={12} className={loadingCola ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>

        {cola ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <StatBadge label="Pendientes" count={cola.resumen.pendiente || 0} color="bg-amber-100 text-amber-700" />
              <StatBadge label="En progreso" count={cola.resumen.en_progreso || 0} color="bg-blue-100 text-blue-700" />
              <StatBadge label="Completados" count={cola.resumen.completado || 0} color="bg-emerald-100 text-emerald-700" />
              <StatBadge label="No cliente" count={cola.resumen.no_cliente || 0} color="bg-gray-100 text-gray-600" />
            </div>

            {/* Tabla */}
            {(() => {
              const totalPages = Math.ceil(cola.dnis.length / pageSize);
              const paged = cola.dnis.slice((page - 1) * pageSize, page * pageSize);
              return cola.dnis.length > 0 ? (
                <>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b border-[#e8dce6]">
                          <th className="table-header px-3 py-2 text-left">DNI</th>
                          <th className="table-header px-3 py-2 text-left">Estado</th>
                          <th className="table-header px-3 py-2 text-left">Última actualización</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paged.map((d) => (
                          <tr key={d.id_cliente} className="border-b border-[#f0f0f8] hover:bg-[#f8f7fa]">
                            <td className="py-2 px-3 font-mono">{d.id_cliente}</td>
                            <td className="py-2 px-3">
                              <EstadoBadge estado={d.estado || 'pendiente'} />
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
                    <div className="flex items-center justify-between px-4 py-2 border-t border-[#e8dce6]">
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
              ) : null;
            })()}
          </>
        ) : (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-[#b8b0b8]" />
          </div>
        )}
      </div>
      {/* ── Info ── */}
      <div className="mt-8 card-sm bg-[#f8f7fa] dark:bg-[#1e1a2a] border-dashed border-[#e0e0f0] dark:border-[#2a1f3a]">
        <h3 className="text-xs font-semibold text-[#7c757c] uppercase tracking-wider mb-2">💡 ¿Cómo funciona?</h3>
        <ul className="space-y-1 text-[11px] text-[#7c757c]">
          <li>· Sube archivos Excel con DNIs para encolar. El bot los procesará automáticamente. Monitorea el progreso de la cola.</li>
        </ul>
      </div>
    </div>
  );
}

function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`rounded-lg px-3 py-2 text-center ${color}`}>
      <p className="text-lg font-bold">{count}</p>
      <p className="text-[10px] font-medium">{label}</p>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    pendiente: 'bg-amber-100 text-amber-700',
    en_progreso: 'bg-blue-100 text-blue-700',
    completado: 'bg-emerald-100 text-emerald-700',
    no_cliente: 'bg-gray-100 text-gray-600',
    error: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${map[estado] || 'bg-gray-100 text-gray-600'}`}>
      {estado.replace('_', ' ')}
    </span>
  );
}
