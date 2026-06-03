/**
 * app/(dashboard)/admin/documentos/page.tsx — Subida de DNIs
 */

'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function DocumentosPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dnis, setDnis] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ status: string; text: string } | null>(null);

  const parseFile = useCallback(async (file: File) => {
    const text = await file.text();
    const found: Set<string> = new Set();
    for (const line of text.split('\n')) {
      const clean = line.trim().replace(/^"|"$/g, '');
      if (!clean || clean.startsWith('#')) continue;
      // DNI/NIE/NIF español
      const match = clean.match(/\b[A-Za-z]?\d{7,8}[A-Za-z]?\b/);
      if (match && match[0].length >= 6) found.add(match[0].toUpperCase());
    }
    return Array.from(found);
  }, []);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    setFile(f);
    setDnis(await parseFile(f));
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file || dnis.length === 0) return;
    setUploading(true);
    try {
      const res = await fetch('/api/documentos/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_archivo: file.name, dnis }),
      });
      if (!res.ok) throw new Error();
      setResult({ status: 'ok', text: `${dnis.length} DNIs cargados correctamente.` });
      setFile(null);
      setDnis([]);
    } catch {
      setResult({ status: 'error', text: 'Error al cargar los DNIs.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#1a1030]">Subida de Documentos</h1>

      {/* Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
          file ? 'border-emerald-300 bg-emerald-50' : 'border-[#e0e0f0] bg-white hover:border-[#0a6ea9]'
        }`}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setFile(f);
            setDnis(await parseFile(f));
            setResult(null);
          }}
        />
        {file ? (
          <div className="space-y-2">
            <FileText size={40} className="text-emerald-500 mx-auto" />
            <p className="text-[#1a1030] font-medium">{file.name}</p>
            <p className="text-sm text-[#7c757c]">{dnis.length} DNIs detectados</p>
          </div>
        ) : (
          <>
            <Upload size={40} className="text-[#b8b0b8] mx-auto mb-3" />
            <p className="text-[#1a1030] font-medium">Arrastra un archivo .csv o .txt aquí</p>
            <p className="text-sm text-[#7c757c] mt-1">o haz clic para seleccionarlo</p>
          </>
        )}
      </div>

      {/* Preview */}
      {dnis.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#1a1030]">{dnis.length} DNIs detectados</h3>
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
            <div className={`mb-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 border ${
              result.status === 'ok'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {result.status === 'ok' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              {result.text}
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
    </div>
  );
}
