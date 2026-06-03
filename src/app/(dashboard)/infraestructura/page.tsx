/**
 * app/(dashboard)/infraestructura/page.tsx — Máquinas y Proxies
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Monitor, Wifi, Plus, Trash2, Loader2, Copy, Check, X, Globe, Server } from 'lucide-react';

type ProxyInfo = { ip: string; port: string; user: string; pass: string; raw: string };

export default function InfraestructuraPage() {
  const [proxies, setProxies] = useState<ProxyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [newPort, setNewPort] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const fetchProxies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/proxies');
      const data = await res.json();
      setProxies(data.proxies || []);
    } catch {
      setError('No se pudieron cargar los proxies');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProxies(); }, [fetchProxies]);

  const handleAdd = async () => {
    if (!newIp || !newPort) return;
    setAdding(true);
    setError('');
    try {
      const res = await fetch('/api/proxies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: newIp.trim(), port: newPort.trim(), user: newUser.trim(), pass: newPass.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setNewIp(''); setNewPort(''); setNewUser(''); setNewPass('');
      fetchProxies();
    } catch (e: any) {
      setError(e.message);
    }
    setAdding(false);
  };

  const handleDelete = async (ip: string) => {
    setError('');
    try {
      const res = await fetch('/api/proxies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error');
      }
      fetchProxies();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const copyLine = (raw: string) => {
    navigator.clipboard.writeText(raw);
    setCopied(raw);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#1a1030]">Infraestructura</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <Monitor size={32} className="text-[#0a6ea9] mx-auto mb-2" />
          <p className="text-2xl font-bold text-[#1a1030]">1</p>
          <p className="text-xs text-[#7c757c]">Máquina activa</p>
        </div>
        <div className="card text-center">
          <Wifi size={32} className="text-[#481163] mx-auto mb-2" />
          <p className="text-2xl font-bold text-[#1a1030]">{proxies.length}</p>
          <p className="text-xs text-[#7c757c]">Proxies disponibles</p>
        </div>
      </div>

      {/* Add proxy form */}
      <div className="card">
        <h3 className="text-sm font-semibold text-[#1a1030] mb-3 flex items-center gap-2">
          <Plus size={16} className="text-[#0a6ea9]" />
          Agregar Proxy
        </h3>
        <div className="grid grid-cols-5 gap-2 mb-3">
          <input placeholder="IP" value={newIp}
            onChange={e => setNewIp(e.target.value)}
            className="border border-[#e0e0f0] rounded-lg px-3 py-2 text-sm col-span-2" />
          <input placeholder="Puerto" value={newPort}
            onChange={e => setNewPort(e.target.value)}
            className="border border-[#e0e0f0] rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Usuario" value={newUser}
            onChange={e => setNewUser(e.target.value)}
            className="border border-[#e0e0f0] rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Contraseña" value={newPass}
            onChange={e => setNewPass(e.target.value)}
            className="border border-[#e0e0f0] rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleAdd} disabled={adding || !newIp || !newPort}
            className="btn-primary flex items-center gap-2 text-xs disabled:opacity-40">
            {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Agregar
          </button>
          <span className="text-[10px] text-[#7c757c]">
            Formato: ip:puerto:usuario:contraseña
          </span>
        </div>
        {error && (
          <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
            <X size={12} /> {error}
          </p>
        )}
      </div>

      {/* Proxy list */}
      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8dce6]">
          <h3 className="text-sm font-semibold text-[#1a1030] flex items-center gap-2">
            <Globe size={16} className="text-[#0a6ea9]" />
            Proxies ({proxies.length})
          </h3>
          <button onClick={fetchProxies} className="text-xs text-[#7c757c] hover:text-[#0a6ea9]">
            Refrescar
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-[#b8b0b8]" />
          </div>
        ) : proxies.length === 0 ? (
          <div className="text-center py-12">
            <Server size={40} className="text-[#b8b0b8] mx-auto mb-2" />
            <p className="text-sm text-[#7c757c]">No hay proxies configurados</p>
            <p className="text-xs text-[#b8b0b8] mt-1">
              Agrega uno usando el formulario de arriba
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e8dce6] bg-[#f8f7fa]">
                  <th className="table-header px-4 py-2.5 text-left">#</th>
                  <th className="table-header px-4 py-2.5 text-left">IP</th>
                  <th className="table-header px-4 py-2.5 text-left">Puerto</th>
                  <th className="table-header px-4 py-2.5 text-left">Usuario</th>
                  <th className="table-header px-4 py-2.5 text-left">Contraseña</th>
                  <th className="table-header px-4 py-2.5 text-center w-24">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {proxies.map((p, i) => (
                  <tr key={p.ip} className="border-b border-[#f0f0f8] hover:bg-[#f8f7fa] transition-colors">
                    <td className="py-2.5 px-4 text-xs text-[#7c757c]">{i + 1}</td>
                    <td className="py-2.5 px-4 text-xs font-mono font-medium">{p.ip}</td>
                    <td className="py-2.5 px-4 text-xs font-mono">{p.port}</td>
                    <td className="py-2.5 px-4 text-xs font-mono">{p.user || '—'}</td>
                    <td className="py-2.5 px-4 text-xs font-mono">
                      {p.pass ? '••••••••' : '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => copyLine(p.raw)}
                          className="p-1.5 rounded hover:bg-[#e8dce6] transition-colors"
                          title="Copiar línea completa"
                        >
                          {copied === p.raw ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-[#7c757c]" />}
                        </button>
                        <button
                          onClick={() => handleDelete(p.ip)}
                          className="p-1.5 rounded hover:bg-red-50 transition-colors"
                          title="Eliminar proxy"
                        >
                          <Trash2 size={14} className="text-red-400 hover:text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card bg-[#f8f7fa] border-[#e8dce6]">
        <h3 className="text-sm font-semibold text-[#1a1030] mb-2">¿Cómo funcionan los proxies?</h3>
        <ul className="text-xs text-[#7c757c] space-y-1">
          <li>· El archivo <code className="bg-white px-1 rounded border border-[#e0e0f0]">proxies.txt</code> se actualiza automáticamente al agregar/quitar desde aquí</li>
          <li>· Cada worker del bot usa un proxy distinto (rotación 1:1 por worker ID)</li>
          <li>· Para que los cambios surtan efecto, reinicia el coordinator o lanza "Iniciar" desde Bots</li>
        </ul>
      </div>
    </div>
  );
}
