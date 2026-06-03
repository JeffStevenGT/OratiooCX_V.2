/**
 * app/(dashboard)/admin/documentos/page.tsx — Subida de DNIs
 */

'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, AlertTriangle, Table2 } from 'lucide-react';

export default function DocumentosPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dnis, setDnis] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ status: string; text: string } | null>(null);

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

      setResult({ status: 'ok', text: `${data.count || dnis.length} DNIs cargados correctamente.` });
      setFile(null);
      setDnis([]);
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
          Carga un archivo con DNIs para que el bot los procese automáticamente.
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
            <div
              className={`mb-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 border ${
                result.status === 'ok'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {result.status === 'ok' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              {result.text}
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

      {/* Info adicional */}
      {!file && (
        <div className="card bg-[#f8f7fa] border-[#e8dce6]">
          <h3 className="text-sm font-semibold text-[#1a1030] mb-2">¿Cómo funciona?</h3>
          <ol className="text-xs text-[#7c757c] space-y-1 list-decimal list-inside">
            <li>Sube un archivo con DNIs (una columna en Excel, o uno por línea en TXT/CSV)</li>
            <li>El sistema detecta automáticamente los DNIs válidos</li>
            <li>Al hacer clic en <strong>Cargar DNIs</strong>, se registran como pendientes</li>
            <li>El bot los procesa automáticamente cuando está activo</li>
          </ol>
        </div>
      )}
    </div>
  );
}
