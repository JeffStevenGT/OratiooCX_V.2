/**
 * app/(dashboard)/infraestructura/page.tsx — Máquinas y Proxies
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Monitor, Wifi, Plus, Trash2, Loader2, Copy, Check, X, Globe, Server, RefreshCw } from 'lucide-react';
import Paginator from '@/components/shared/Paginator';

type ProxyInfo = { ip: string; port: string; user: string; pass: string; raw: string };
type Maquina = { id: number; nombre: string; ip: string | null; workers_max: number; workers_activos: number; estado: string; ultimo_heartbeat: string | null };

export default function InfraestructuraPage() {
  // Proxies
  const [proxies, setProxies] = useState<ProxyInfo[]>([]);
  const [loadingProxies, setLoadingProxies] = useState(true);
  const [newIp, setNewIp] = useState('');
  const [newPort, setNewPort] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [proxyPage, setProxyPage] = useState(1);
  const [proxyPS, setProxyPS] = useState(10);

  // Máquinas
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [loadingMaquinas, setLoadingMaquinas] = useState(true);
  const [newMachine, setNewMachine] = useState({ nombre: '', ip: '', workers: 5, notas: '' });
  const [addingMachine, setAddingMachine] = useState(false);
  const [machinePage, setMachinePage] = useState(1);
  const [machinePS, setMachinePS] = useState(10);

  const [error, setError] = useState('');
  const [tab, setTab] = useState<'proxies' | 'maquinas'>('proxies');

  // ── Proxies ──
  const fetchProxies = useCallback(async () => {
    setLoadingProxies(true);
    try {
      const res = await fetch('/api/proxies');
      setProxies((await res.json()).proxies || []);
    } catch { setError('No se pudieron cargar los proxies'); }
    setLoadingProxies(false);
  }, []);

  const fetchMaquinas = useCallback(async () => {
    setLoadingMaquinas(true);
    try {
      const res = await fetch('/api/maquinas');
      const data = await res.json();
      setMaquinas(Array.isArray(data) ? data : []);
      if (!Array.isArray(data)) setError(data.error || 'Error al cargar máquinas');
    } catch { setError('No se pudieron cargar las máquinas'); }
    setLoadingMaquinas(false);
  }, []);

  useEffect(() => { fetchProxies(); fetchMaquinas(); }, [fetchProxies, fetchMaquinas]);

  const handleAddProxy = async () => {
    if (!newIp || !newPort) return;
    setAdding(true); setError('');
    try {
      const res = await fetch('/api/proxies', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: newIp.trim(), port: newPort.trim(), user: newUser.trim(), pass: newPass.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      setNewIp(''); setNewPort(''); setNewUser(''); setNewPass('');
      fetchProxies();
    } catch (e: any) { setError(e.message); }
    setAdding(false);
  };

  const handleDeleteProxy = async (ip: string) => {
    setError('');
    try {
      const res = await fetch('/api/proxies', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      fetchProxies();
    } catch (e: any) { setError(e.message); }
  };

  const copyLine = (raw: string) => { navigator.clipboard.writeText(raw); setCopied(raw); setTimeout(() => setCopied(null), 2000); };

  // ── Máquinas ──
  const handleAddMachine = async () => {
    if (!newMachine.nombre) return;
    setAddingMachine(true); setError('');
    try {
      const res = await fetch('/api/maquinas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMachine),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      setNewMachine({ nombre: '', ip: '', workers: 5, notas: '' });
      fetchMaquinas();
    } catch (e: any) { setError(e.message); }
    setAddingMachine(false);
  };

  const handleDeleteMachine = async (id: number) => {
    setError('');
    try {
      const res = await fetch('/api/maquinas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      fetchMaquinas();
    } catch (e: any) { setError(e.message); }
  };

  const proxiesPaged = proxies.slice((proxyPage - 1) * proxyPS, proxyPage * proxyPS);
  const machinesPaged = maquinas.slice((machinePage - 1) * machinePS, machinePage * machinePS);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#1a1030]">Infraestructura</h1>

      <div className="flex gap-2 border-b border-[#e8dce6]">
        <button onClick={() => setTab('proxies')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'proxies' ? 'border-[#0a6ea9] text-[#0a6ea9]' : 'border-transparent text-[#7c757c] hover:text-[#1a1030]'}`}>Proxies ({proxies.length})</button>
        <button onClick={() => setTab('maquinas')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'maquinas' ? 'border-[#0a6ea9] text-[#0a6ea9]' : 'border-transparent text-[#7c757c] hover:text-[#1a1030]'}`}>Máquinas ({maquinas.length})</button>
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <X size={12} /> {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {/* ── Proxies ── */}
      {tab === 'proxies' && (<>
        <div className="card">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Plus size={16} className="text-[#0a6ea9]" /> Agregar Proxy</h3>
          <div className="grid grid-cols-5 gap-2 mb-3">
            <input placeholder="IP" value={newIp} onChange={e => setNewIp(e.target.value)} className="border border-[#e0e0f0] rounded-lg px-3 py-2 text-sm col-span-2" />
            <input placeholder="Puerto" value={newPort} onChange={e => setNewPort(e.target.value)} className="border border-[#e0e0f0] rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Usuario" value={newUser} onChange={e => setNewUser(e.target.value)} className="border border-[#e0e0f0] rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Contraseña" value={newPass} onChange={e => setNewPass(e.target.value)} className="border border-[#e0e0f0] rounded-lg px-3 py-2 text-sm" />
          </div>
          <button onClick={handleAddProxy} disabled={adding || !newIp || !newPort} className="btn-primary flex items-center gap-2 text-xs disabled:opacity-40">
            {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Agregar
          </button>
        </div>
        <div className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8dce6]">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Globe size={16} className="text-[#0a6ea9]" /> Proxies ({proxies.length})</h3>
            <button onClick={fetchProxies} className="text-xs text-[#7c757c] hover:text-[#0a6ea9]"><RefreshCw size={12} /></button>
          </div>
          {loadingProxies ? <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-[#b8b0b8]" /></div>
          : proxies.length === 0 ? <div className="text-center py-12"><Wifi size={40} className="text-[#b8b0b8] mx-auto mb-2" /><p className="text-sm text-[#7c757c]">No hay proxies</p></div>
          : <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-[#e8dce6] bg-[#f8f7fa]">
                <th className="table-header px-4 py-2.5 text-left">#</th><th className="table-header px-4 py-2.5 text-left">IP</th><th className="table-header px-4 py-2.5 text-left">Puerto</th><th className="table-header px-4 py-2.5 text-left">Usuario</th><th className="table-header px-4 py-2.5 text-left">Pass</th><th className="table-header px-4 py-2.5 text-center w-24">Acciones</th>
              </tr></thead>
              <tbody>
                {proxiesPaged.map((p, i) => (
                  <tr key={p.ip} className="border-b border-[#f0f0f8] hover:bg-[#f8f7fa]">
                    <td className="py-2.5 px-4 text-xs text-[#7c757c]">{(proxyPage - 1) * proxyPS + i + 1}</td>
                    <td className="py-2.5 px-4 text-xs font-mono font-medium">{p.ip}</td>
                    <td className="py-2.5 px-4 text-xs font-mono">{p.port}</td>
                    <td className="py-2.5 px-4 text-xs font-mono">{p.user || '—'}</td>
                    <td className="py-2.5 px-4 text-xs font-mono">{p.pass ? '••••••••' : '—'}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => copyLine(p.raw)} className="p-1.5 rounded hover:bg-[#e8dce6]" title="Copiar">
                          {copied === p.raw ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-[#7c757c]" />}</button>
                        <button onClick={() => handleDeleteProxy(p.ip)} className="p-1.5 rounded hover:bg-red-50" title="Eliminar">
                          <Trash2 size={14} className="text-red-400 hover:text-red-600" /></button>
                      </div>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>}
          <Paginator page={proxyPage} total={proxies.length} pageSize={proxyPS} setPage={setProxyPage} setPageSize={setProxyPS} />
        </div>
      </>)}

      {/* ── Máquinas ── */}
      {tab === 'maquinas' && (<>
        <div className="card">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Plus size={16} className="text-[#0a6ea9]" /> Agregar Máquina</h3>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <input placeholder="Nombre (ej: vps-espana-1)" value={newMachine.nombre} onChange={e => setNewMachine({ ...newMachine, nombre: e.target.value })} className="border border-[#e0e0f0] rounded-lg px-3 py-2 text-sm col-span-2" />
            <input placeholder="IP" value={newMachine.ip} onChange={e => setNewMachine({ ...newMachine, ip: e.target.value })} className="border border-[#e0e0f0] rounded-lg px-3 py-2 text-sm" />
            <input type="number" min={1} max={20} placeholder="Workers máx" value={newMachine.workers} onChange={e => setNewMachine({ ...newMachine, workers: +e.target.value })} className="border border-[#e0e0f0] rounded-lg px-3 py-2 text-sm" />
          </div>
          <input placeholder="Notas (opcional)" value={newMachine.notas} onChange={e => setNewMachine({ ...newMachine, notas: e.target.value })} className="border border-[#e0e0f0] rounded-lg px-3 py-2 text-sm w-full mb-3" />
          <button onClick={handleAddMachine} disabled={addingMachine || !newMachine.nombre} className="btn-primary flex items-center gap-2 text-xs disabled:opacity-40">
            {addingMachine ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Agregar Máquina
          </button>
        </div>
        <div className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8dce6]">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Server size={16} className="text-[#0a6ea9]" /> Máquinas ({maquinas.length})</h3>
            <button onClick={fetchMaquinas} className="text-xs text-[#7c757c] hover:text-[#0a6ea9]"><RefreshCw size={12} /></button>
          </div>
          {loadingMaquinas ? <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-[#b8b0b8]" /></div>
          : maquinas.length === 0 ? <div className="text-center py-12"><Monitor size={40} className="text-[#b8b0b8] mx-auto mb-2" /><p className="text-sm text-[#7c757c]">No hay máquinas registradas</p></div>
          : <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-[#e8dce6] bg-[#f8f7fa]">
                <th className="table-header px-4 py-2.5 text-left">Nombre</th><th className="table-header px-4 py-2.5 text-left">IP</th><th className="table-header px-4 py-2.5 text-center">Estado</th><th className="table-header px-4 py-2.5 text-center">Workers</th><th className="table-header px-4 py-2.5 text-left">Último heartbeat</th><th className="table-header px-4 py-2.5 text-center w-16"></th>
              </tr></thead>
              <tbody>
                {machinesPaged.map(m => (
                  <tr key={m.id} className="border-b border-[#f0f0f8] hover:bg-[#f8f7fa]">
                    <td className="py-2.5 px-4 text-xs font-medium">{m.nombre}</td>
                    <td className="py-2.5 px-4 text-xs font-mono text-[#7c757c]">{m.ip || '—'}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 ${m.estado === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${m.estado === 'online' ? 'bg-emerald-400' : 'bg-gray-400'}`} />{m.estado}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center text-xs"><span className="font-medium">{m.workers_activos}</span><span className="text-[#7c757c]">/{m.workers_max}</span></td>
                    <td className="py-2.5 px-4 text-xs text-[#7c757c]">{m.ultimo_heartbeat ? new Date(m.ultimo_heartbeat).toLocaleString('es-PE') : '—'}</td>
                    <td className="py-2.5 px-4 text-center"><button onClick={() => handleDeleteMachine(m.id)} className="p-1.5 rounded hover:bg-red-50" title="Eliminar"><Trash2 size={14} className="text-red-400 hover:text-red-600" /></button></td>
                  </tr>))}
              </tbody>
            </table>
          </div>}
          <Paginator page={machinePage} total={maquinas.length} pageSize={machinePS} setPage={setMachinePage} setPageSize={setMachinePS} />
        </div>
      </>)}

      <div className="card bg-[#f8f7fa] border-[#e8dce6]">
        <h3 className="text-sm font-semibold text-[#1a1030] mb-2">¿Cómo funciona?</h3>
        <ul className="text-xs text-[#7c757c] space-y-1">
          <li>· <strong>Proxies:</strong> se guardan en <code className="bg-white px-1 rounded border border-[#e0e0f0]">proxies.txt</code>. Cada worker usa uno distinto.</li>
          <li>· <strong>Máquinas:</strong> registra cada VPS donde corre un coordinator. El coordinator envía heartbeat cada 30s.</li>
          <li>· Para lanzar workers en una máquina: <code className="bg-white px-1 rounded border border-[#e0e0f0]">python bot/coordinator_loop.py --machine-name NOMBRE</code></li>
        </ul>
      </div>
    </div>
  );
}
