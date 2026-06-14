/**
 * app/(dashboard)/bots/page.tsx — Apps (Control + Proxies + Máquinas)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Play, Pause, Square, Loader2, Globe, Users, Activity, Plus, Trash2, Copy, Check, X, Wifi, RefreshCw, Server, Monitor, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { toast } from '@/components/shared/Toast';
import Paginator from '@/components/shared/Paginator';

type ProxyInfo = { ip: string; port: string; user: string; pass: string; raw: string };
type Maquina = { id: number; nombre: string; ip: string | null; workers_max: number; workers_activos: number; estado: string; ultimo_heartbeat: string | null };

export default function AppsPage() {
  const [tab, setTab] = useState<'control' | 'proxies' | 'maquinas' | 'config'>('control');

  // ── Control ──
  const [sending, setSending] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [workers, setWorkers] = useState(5);
  const [ctrlMaquina, setCtrlMaquina] = useState('*');
  const [ctrlMaquinas, setCtrlMaquinas] = useState<Maquina[]>([]);
  const [statusMsg, setStatusMsg] = useState('Coordinator en espera');

  // ── Proxies ──
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
  const [showAddProxy, setShowAddProxy] = useState(false);

  // ── Máquinas ──
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [loadingMaquinas, setLoadingMaquinas] = useState(true);
  const [newMachine, setNewMachine] = useState({ nombre: '', ip: '', workers: 5, notas: '' });
  const [addingMachine, setAddingMachine] = useState(false);
  const [machinePage, setMachinePage] = useState(1);
  const [machinePS, setMachinePS] = useState(10);
  const [showAddMachine, setShowAddMachine] = useState(false);

  const [error, setError] = useState('');

  // ── Fetch ──
  const fetchMaquinas = useCallback(async () => {
    setLoadingMaquinas(true);
    try { const res = await fetch('/api/maquinas'); const data = await res.json(); setMaquinas(Array.isArray(data) ? data : []); setCtrlMaquinas(Array.isArray(data) ? data : []); } catch { setError('No se pudieron cargar las máquinas'); }
    setLoadingMaquinas(false);
  }, []);

  const fetchProxies = useCallback(async () => {
    setLoadingProxies(true);
    try { setProxies(((await (await fetch('/api/proxies')).json()).proxies || [])); } catch { setError('No se pudieron cargar los proxies'); }
    setLoadingProxies(false);
  }, []);

  useEffect(() => { fetchMaquinas(); fetchProxies(); }, [fetchMaquinas, fetchProxies]);

  const onlineCount = ctrlMaquinas.filter(m => m.estado === 'online').length;
  const totalWorkers = ctrlMaquinas.reduce((s, m) => s + m.workers_activos, 0);

  // ── Control Workers ──
  const sendCommand = async (cmd: string, label: string) => { setSending(cmd); setStatusMsg(`Enviando "${label}"...`);
    try { const res = await fetch('/api/bot/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comando: cmd, workers, maquina: ctrlMaquina }) }); const data = await res.json().catch(() => ({}));
      if (res.ok) { setLastAction(cmd); toast.success(`${label} completado`); setStatusMsg(`${label} — ${workers} workers`); }
      else { toast.error(data.error || `Error ${res.status}`); setStatusMsg(data.error || `Error ${res.status}`); }
    } catch { toast.error('Error de conexión'); setStatusMsg('Error de conexión'); }
    setTimeout(() => setSending(null), 1500); };

  // ── Proxies ──
  const handleAddProxy = async () => { if (!newIp || !newPort) return; setAdding(true); setError('');
    try { const res = await fetch('/api/proxies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip: newIp.trim(), port: newPort.trim(), user: newUser.trim(), pass: newPass.trim() }) }); if (!res.ok) throw new Error((await res.json()).error || 'Error'); setNewIp(''); setNewPort(''); setNewUser(''); setNewPass(''); setShowAddProxy(false); fetchProxies(); } catch (e: any) { setError(e.message); } setAdding(false); };
  const handleDeleteProxy = async (ip: string) => { setError('');
    try { const res = await fetch('/api/proxies', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip }) }); if (!res.ok) throw new Error((await res.json()).error || 'Error'); fetchProxies(); } catch (e: any) { setError(e.message); } };
  const copyLine = (raw: string) => { navigator.clipboard.writeText(raw); setCopied(raw); setTimeout(() => setCopied(null), 2000); };

  // ── Máquinas CRUD ──
  const handleAddMachine = async () => { if (!newMachine.nombre) return; setAddingMachine(true); setError('');
    try { const res = await fetch('/api/maquinas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newMachine) }); if (!res.ok) throw new Error((await res.json()).error || 'Error'); setNewMachine({ nombre: '', ip: '', workers: 5, notas: '' }); setShowAddMachine(false); fetchMaquinas(); } catch (e: any) { setError(e.message); } setAddingMachine(false); };
  const handleDeleteMachine = async (id: number) => { setError('');
    try { const res = await fetch('/api/maquinas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); if (!res.ok) throw new Error((await res.json()).error || 'Error'); fetchMaquinas(); } catch (e: any) { setError(e.message); } };

  const proxiesPaged = proxies.slice((proxyPage - 1) * proxyPS, proxyPage * proxyPS);
  const machinesPaged = maquinas.slice((machinePage - 1) * machinePS, machinePage * machinePS);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + quick stats */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe size={22} className="text-[#0a6ea9]" />Apps
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Control de workers, proxies y máquinas</p>
        </div>
        <div className="flex gap-3">
          <div className="text-center px-3 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-400">Máquinas</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{onlineCount}/{ctrlMaquinas.length}</p>
          </div>
          <div className="text-center px-3 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-400">Workers</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{totalWorkers}</p>
          </div>
          <div className="text-center px-3 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-400">Proxies</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{proxies.length}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {([
          ['control', 'Control', Activity],
          ['proxies', 'Proxies', Wifi],
          ['maquinas', 'Máquinas', Server],
          ['config', 'Config', Settings],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              tab === key ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            <Icon size={15} />
            {label}
            {key === 'proxies' && <span className="text-[10px] opacity-60">{proxies.length}</span>}
            {key === 'maquinas' && <span className="text-[10px] opacity-60">{maquinas.length}</span>}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <X size={14} /> {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {/* ─── TAB: Control ─── */}
      {tab === 'control' && (<>
        {/* Status bar */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border-l-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${
          lastAction === 'iniciar' ? 'border-l-emerald-500' : lastAction === 'detener' ? 'border-l-red-500' : 'border-l-gray-300'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full ${lastAction === 'iniciar' ? 'bg-emerald-500 animate-pulse' : lastAction === 'detener' ? 'bg-red-500' : 'bg-gray-400'}`} />
          <p className="text-sm text-gray-700 dark:text-gray-300">{statusMsg}</p>
        </div>

        {/* Control card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Activity size={18} className="text-[#0a6ea9]" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Control de Workers</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">Orange</span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Workers simultáneos</label>
              <div className="flex items-center gap-2">
                <Users size={16} className="text-gray-400" />
                <input type="number" min={1} max={20} value={workers}
                  onChange={e => setWorkers(Math.max(1, Math.min(20, +e.target.value || 1)))}
                  className="w-20 border-0 bg-transparent text-2xl font-bold text-gray-900 dark:text-white focus:outline-none" />
                <span className="text-sm text-gray-400">/ 20 máx</span>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Máquina destino</label>
              <select value={ctrlMaquina} onChange={e => setCtrlMaquina(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-gray-900 dark:text-white border-0 focus:outline-none cursor-pointer">
                <option value="*">🌐 Todas las máquinas</option>
                {ctrlMaquinas.map(m => (
                  <option key={m.id} value={m.nombre}>{m.nombre} ({m.estado === 'online' ? '🟢' : '🔴'} {m.workers_activos} workers)</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => sendCommand('iniciar', 'Iniciar')} disabled={sending !== null}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium text-sm rounded-xl transition-colors">
              {sending === 'iniciar' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Iniciar
            </button>
            <button onClick={() => sendCommand('pausar', 'Pausar')} disabled={sending !== null}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium text-sm rounded-xl transition-colors">
              {sending === 'pausar' ? <Loader2 size={16} className="animate-spin" /> : <Pause size={16} />}
            </button>
            <button onClick={() => sendCommand('detener', 'Detener')} disabled={sending !== null}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium text-sm rounded-xl transition-colors">
              {sending === 'detener' ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
            </button>
          </div>
        </div>
      </>)}

      {/* ─── TAB: Proxies ─── */}
      {tab === 'proxies' && (<>
        {/* Add proxy (collapsible) */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button onClick={() => setShowAddProxy(!showAddProxy)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Plus size={16} className="text-[#0a6ea9]" /> Agregar Proxy
            </div>
            {showAddProxy ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>
          {showAddProxy && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                <input placeholder="IP" value={newIp} onChange={e => setNewIp(e.target.value)}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                <input placeholder="Puerto" value={newPort} onChange={e => setNewPort(e.target.value)}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                <input placeholder="Usuario" value={newUser} onChange={e => setNewUser(e.target.value)}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                <input placeholder="Contraseña" value={newPass} onChange={e => setNewPass(e.target.value)}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <button onClick={handleAddProxy} disabled={adding || !newIp || !newPort}
                className="mt-3 bg-[#0a6ea9] hover:bg-[#085d8f] disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Agregar
              </button>
            </div>
          )}
        </div>

        {/* Proxy list */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Wifi size={16} className="text-[#0a6ea9]" /> {proxies.length} proxies
            </h3>
            <button onClick={fetchProxies} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-[#0a6ea9] transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
          {loadingProxies ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
          ) : proxies.length === 0 ? (
            <div className="text-center py-16">
              <Wifi size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400 mb-3">No hay proxies configurados</p>
              <button onClick={() => setShowAddProxy(true)}
                className="text-sm text-[#0a6ea9] hover:text-[#085d8f] font-medium">+ Agregar el primero</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">IP</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Puerto</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Usuario</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-20"></th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {proxiesPaged.map(p => (
                    <tr key={p.ip} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-4 py-2.5 text-sm font-mono font-medium text-gray-900 dark:text-white">{p.ip}</td>
                      <td className="px-4 py-2.5 text-sm font-mono text-gray-500">{p.port}</td>
                      <td className="px-4 py-2.5 text-sm font-mono text-gray-500">{p.user || '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => copyLine(p.raw)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Copiar">
                            {copied === p.raw ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                          <button onClick={() => handleDeleteProxy(p.ip)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500" title="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {proxies.length > proxyPS && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                  <Paginator page={proxyPage} total={proxies.length} pageSize={proxyPS} setPage={setProxyPage} setPageSize={setProxyPS} />
                </div>
              )}
            </div>
          )}
        </div>
      </>)}

      {/* ─── TAB: Máquinas ─── */}
      {tab === 'maquinas' && (<>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button onClick={() => setShowAddMachine(!showAddMachine)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Plus size={16} className="text-[#0a6ea9]" /> Agregar Máquina
            </div>
            {showAddMachine ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>
          {showAddMachine && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
              <div className="grid grid-cols-2 gap-2 mt-4">
                <input placeholder="Nombre (ej: vps-1)" value={newMachine.nombre}
                  onChange={e => setNewMachine({ ...newMachine, nombre: e.target.value })}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                <input placeholder="IP" value={newMachine.ip}
                  onChange={e => setNewMachine({ ...newMachine, ip: e.target.value })}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <label className="text-xs text-gray-500">Workers máx:</label>
                <input type="number" min={1} max={20} value={newMachine.workers}
                  onChange={e => setNewMachine({ ...newMachine, workers: +e.target.value })}
                  className="w-16 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <button onClick={handleAddMachine} disabled={addingMachine || !newMachine.nombre}
                className="mt-3 bg-[#0a6ea9] hover:bg-[#085d8f] disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                {addingMachine ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Agregar
              </button>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Server size={16} className="text-[#0a6ea9]" /> {maquinas.length} máquinas
            </h3>
            <button onClick={fetchMaquinas} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-[#0a6ea9] transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
          {loadingMaquinas ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
          ) : maquinas.length === 0 ? (
            <div className="text-center py-16">
              <Monitor size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400 mb-3">No hay máquinas registradas</p>
              <button onClick={() => setShowAddMachine(true)}
                className="text-sm text-[#0a6ea9] hover:text-[#085d8f] font-medium">+ Agregar la primera</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Nombre</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">IP</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Workers</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Heartbeat</th>
                  <th className="px-4 py-2.5 w-12"></th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {machinesPaged.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white">{m.nombre}</td>
                      <td className="px-4 py-2.5 text-sm font-mono text-gray-500">{m.ip || '—'}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 ${
                          m.estado === 'online' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${m.estado === 'online' ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                          {m.estado}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-sm">
                        <span className="font-medium text-gray-900 dark:text-white">{m.workers_activos}</span>
                        <span className="text-gray-400">/{m.workers_max}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">
                        {m.ultimo_heartbeat ? new Date(m.ultimo_heartbeat).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => handleDeleteMachine(m.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500" title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {maquinas.length > machinePS && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                  <Paginator page={machinePage} total={maquinas.length} pageSize={machinePS} setPage={setMachinePage} setPageSize={setMachinePS} />
                </div>
              )}
            </div>
          )}
        </div>
      </>)}

      {/* ─── TAB: Config ─── */}
      {tab === 'config' && (
        <div className="max-w-xl space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Settings size={18} className="text-[#0a6ea9]" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Parámetros del Bot</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Timeout rescate DNIs', value: '30 min', note: 'Tiempo máximo antes de considerar un DNI atascado' },
                { label: 'Liberación leads', value: '3 días', note: 'Días sin actividad para liberar lead al pool' },
                { label: 'Debounce llamadas', value: '5 seg', note: 'Tiempo mínimo entre llamadas Click2Call' },
                { label: 'Watchdog extracción', value: '40 seg', note: 'Tiempo máximo por DNI en el worker' },
                { label: 'Workers por máquina', value: '20 máx', note: 'Límite configurable desde Control' },
                { label: 'Heartbeat interval', value: '30 seg', note: 'Frecuencia de heartbeat del coordinator' },
              ].map(p => (
                <div key={p.label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{p.label}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{p.value}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{p.note}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-center text-[10px] text-gray-400">
            Estos valores están definidos en el código. Serán editables desde aquí en una versión futura.
          </p>
        </div>
      )}
    </div>
  );
}
