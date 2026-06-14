/**
 * app/(dashboard)/vpbx/page.tsx — Gestión VPBX
 * Asigna extensiones SIP a operadores y monitoriza estado de agentes
 * Roles: supervisor, jefe_area, desarrollador, it
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Phone, UserPlus, Loader2, RefreshCw, User, Check, X,
  Search, PhoneCall, PhoneOff, Clock, Wifi, WifiOff, AlertTriangle,
  Users, ArrowUpDown, Unplug,
} from 'lucide-react';
import { toast } from '@/components/shared/Toast';
import { TableSkeleton } from '@/components/shared/Skeleton';

type VpbxExtension = {
  id?: string;
  extension?: string;
  username?: string;
  number?: string;
  name?: string;
  status?: string;
  assigned_user?: {
    id: number;
    nombre: string;
    email: string;
    rol: string;
    equipo: string | null;
  } | null;
  [key: string]: any;
};

type Usuario = {
  id: number;
  email: string;
  nombre: string;
  rol: string;
  equipo: string | null;
  extension_vpbx: string | null;
  activo: boolean;
};

type VpbxAgent = {
  id?: string;
  agent?: string;
  name?: string;
  status?: string;
  extension?: string;
  [key: string]: any;
};

export default function VpbxPage() {
  const [tab, setTab] = useState<'extensiones' | 'agentes'>('extensiones');

  // Extensiones
  const [extensions, setExtensions] = useState<VpbxExtension[]>([]);
  const [loadingExt, setLoadingExt] = useState(true);
  const [vpbxReady, setVpbxReady] = useState(true);

  // Usuarios para asignación
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Agentes
  const [agents, setAgents] = useState<VpbxAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [pausasData, setPausasData] = useState<Record<number, any>>({});

  // UI state
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [showUserPicker, setShowUserPicker] = useState<string | null>(null);
  const [error, setError] = useState('');

  // ── Fetch Extensiones ──
  const fetchExtensions = useCallback(async () => {
    setLoadingExt(true);
    try {
      const res = await fetch('/api/vpbx/extensions');
      const data = await res.json();
      if (data.vpbxReady === false) {
        setVpbxReady(false);
        setExtensions([]);
      } else {
        setVpbxReady(true);
        setExtensions(Array.isArray(data) ? data : []);
      }
      if (data.error && data.vpbxReady !== false) setError(data.error);
    } catch {
      setVpbxReady(false);
      setError('No se pudo conectar con la VPBX');
    }
    setLoadingExt(false);
  }, []);

  // ── Fetch Usuarios ──
  const fetchUsuarios = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/usuarios');
      setUsuarios((await res.json()) || []);
    } catch { /* ignore */ }
    setLoadingUsers(false);
  }, []);

  // ── Fetch Agentes ──
  const fetchAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const [agentsRes, pausasRes] = await Promise.all([
        fetch('/api/vpbx/agents'),
        fetch('/api/pausas?equipo=1&hoy=1').catch(() => null),
      ]);
      const data = await agentsRes.json();
      setAgents(Array.isArray(data) ? data : []);
      
      // Procesar pausas activas por usuario
      if (pausasRes?.ok) {
        const pausasHoy = await pausasRes.json();
        const activas: Record<number, any> = {};
        for (const p of pausasHoy) {
          if (!p.fin) {
            const inicio = new Date(p.inicio).getTime();
            const duracion = Math.round((Date.now() - inicio) / 1000);
            activas[p.usuario_id] = { ...p, duracionSegundos: duracion };
          }
        }
        setPausasData(activas);
      }
    } catch { /* ignore */ }
    setLoadingAgents(false);
  }, []);

  useEffect(() => {
    fetchExtensions();
    fetchUsuarios();
    fetchAgents();
  }, [fetchExtensions, fetchUsuarios, fetchAgents]);

  // ── Asignar extensión a usuario ──
  const assignExtension = async (extensionId: string, userId: number | null) => {
    setAssigning(extensionId);
    try {
      // Si userId es null, desasignamos
      if (userId === null) {
        // Buscar el usuario que tiene esta extensión y quitársela
        const ext = extensions.find((e) => getExtId(e) === extensionId);
        if (ext?.assigned_user?.id) {
          await fetch('/api/usuarios', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: ext.assigned_user.id, extension_vpbx: null }),
          });
        }
      } else {
        // Si algún otro usuario ya tiene esta extensión, desasignarla primero
        const ext = extensions.find((e) => getExtId(e) === extensionId);
        if (ext?.assigned_user?.id && ext.assigned_user.id !== userId) {
          await fetch('/api/usuarios', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: ext.assigned_user.id, extension_vpbx: null }),
          });
        }
        // Asignar al nuevo usuario
        await fetch('/api/usuarios', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: userId, extension_vpbx: extensionId }),
        });
      }
      toast.success(userId ? 'Extensión asignada' : 'Extensión desasignada');
      // Invalidar cache Redis para que la siguiente carga traiga datos frescos
      await fetch('/api/vpbx/extensions', { method: 'PUT' }).catch(() => {});
      fetchExtensions();
      fetchUsuarios();
    } catch {
      toast.error('Error al asignar extensión');
    }
    setAssigning(null);
    setShowUserPicker(null);
  };

  // ── Helpers ──
  const getExtId = (ext: VpbxExtension) =>
    String(ext.id || ext.extension || ext.username || ext.number || '');

  const getExtLabel = (ext: VpbxExtension) =>
    ext.extension || ext.username || ext.number || ext.id || '—';

  const getExtName = (ext: VpbxExtension) => ext.name || '';

  const getAgentStatusIcon = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('ring') || s.includes('call') || s.includes('busy') || s.includes('inuse'))
      return <PhoneCall size={14} className="text-amber-500" />;
    if (s.includes('available') || s.includes('idle') || s.includes('ok') || s.includes('ready'))
      return <Wifi size={14} className="text-emerald-500" />;
    if (s.includes('offline') || s.includes('unavailable') || s.includes('logged'))
      return <WifiOff size={14} className="text-red-400" />;
    if (s.includes('pause') || s.includes('break'))
      return <Clock size={14} className="text-slate-400" />;
    return <AlertTriangle size={14} className="text-slate-400" />;
  };

  const getAgentStatusLabel = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('ring') || s.includes('call')) return 'En llamada';
    if (s.includes('busy') || s.includes('inuse')) return 'Ocupado';
    if (s.includes('available') || s.includes('idle') || s.includes('ok') || s.includes('ready'))
      return 'Disponible';
    if (s.includes('offline') || s.includes('unavailable') || s.includes('logged')) return 'Offline';
    if (s.includes('pause') || s.includes('break')) return 'Pausa';
    return status || 'Desconocido';
  };

  const getRoleBadge = (rol: string) => {
    const map: Record<string, string> = {
      asesor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
      supervisor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
      jefe_area: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
      back_office: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
      it: 'bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300',
      desarrollador: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
    };
    return map[rol] || 'bg-slate-100 text-slate-700';
  };

  const filteredExtensions = extensions.filter((ext) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const id = getExtId(ext).toLowerCase();
    const name = getExtName(ext).toLowerCase();
    const user = ext.assigned_user?.nombre?.toLowerCase() || '';
    return id.includes(q) || name.includes(q) || user.includes(q);
  });

  // ── Usuarios filtrados para asignación (solo asesores y supervisores sin extensión o con esta) ──
  const getAvailableUsers = (extId: string) => {
    return usuarios.filter((u) => {
      if (u.rol === 'desarrollador' || u.rol === 'it' || u.rol === 'back_office') return false;
      // Usuario ya asignado a esta extensión
      if (u.extension_vpbx === extId) return true;
      // Usuario sin extensión asignada
      if (!u.extension_vpbx) return true;
      return false;
    });
  };

  if (!vpbxReady && !loadingExt) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">VPBX</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestión de extensiones SIP y asignación a operadores
          </p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
          <Phone size={40} className="mx-auto text-amber-500 mb-3" />
          <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
            VPBX no configurada
          </h2>
          <p className="text-sm text-amber-700 dark:text-amber-300 max-w-md mx-auto">
            Configura la variable <code className="bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded text-xs">VPBX_API_KEY</code> en
            el archivo <code className="bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded text-xs">.env.local</code> para
            habilitar la gestión de extensiones y el monitoreo de agentes.
          </p>
          <button
            onClick={() => { fetchExtensions(); fetchAgents(); }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors"
          >
            <RefreshCw size={14} />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">VPBX</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Extensiones SIP y monitoreo de agentes en tiempo real
          </p>
        </div>
        <button
          onClick={() => { fetchExtensions(); fetchAgents(); fetchUsuarios(); }}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('extensiones')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'extensiones'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Phone size={14} className="inline mr-1.5" />
          Extensiones
        </button>
        <button
          onClick={() => setTab('agentes')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'agentes'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Users size={14} className="inline mr-1.5" />
          Agentes
        </button>
      </div>

      {/* ── TAB: Extensiones ── */}
      {tab === 'extensiones' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar extensión o usuario asignado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0a6ea9]/30 focus:border-[#0a6ea9]"
            />
          </div>

          {/* Extensions Table */}
          {loadingExt ? (
            <TableSkeleton rows={5} cols={4} />
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          Extensión <ArrowUpDown size={12} />
                        </span>
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Nombre</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Operador asignado</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExtensions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-12 text-slate-400">
                          <Phone size={32} className="mx-auto mb-2 opacity-50" />
                          {search ? 'Sin resultados' : 'No hay extensiones configuradas'}
                        </td>
                      </tr>
                    ) : (
                      filteredExtensions.map((ext) => {
                        const extId = getExtId(ext);
                        const isAssigned = !!ext.assigned_user;
                        const isAssigning = assigning === extId;
                        const availableUsers = getAvailableUsers(extId);

                        return (
                          <tr
                            key={extId}
                            className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                                {getExtLabel(ext)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                              {getExtName(ext) || '—'}
                            </td>
                            <td className="px-4 py-3">
                              {isAssigned ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-[#481163]/10 flex items-center justify-center">
                                    <User size={12} className="text-[#481163]" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-900 dark:text-white text-xs">
                                      {ext.assigned_user!.nombre}
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                      {ext.assigned_user!.equipo || 'Sin equipo'}
                                      {' · '}
                                      <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getRoleBadge(ext.assigned_user!.rol)}`}>
                                        {ext.assigned_user!.rol.replace('_', ' ')}
                                      </span>
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs italic">Sin asignar</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {isAssigning ? (
                                <Loader2 size={16} className="animate-spin text-[#0a6ea9] inline" />
                              ) : showUserPicker === extId ? (
                                <div className="inline-flex items-center gap-1">
                                  <select
                                    className="text-xs border border-slate-200 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                    onChange={(e) => {
                                      const uid = e.target.value ? parseInt(e.target.value) : null;
                                      assignExtension(extId, uid);
                                    }}
                                    defaultValue={ext.assigned_user?.id || ''}
                                    autoFocus
                                  >
                                    <option value="">— Desasignar —</option>
                                    {availableUsers.map((u) => (
                                      <option key={u.id} value={u.id}>
                                        {u.nombre} ({u.rol})
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => setShowUserPicker(null)}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                                  >
                                    <X size={14} className="text-slate-400" />
                                  </button>
                                </div>
                              ) : isAssigned ? (
                                <button
                                  onClick={() => setShowUserPicker(extId)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-500 hover:text-[#0a6ea9] hover:bg-[#0a6ea9]/5 rounded-md transition-colors"
                                >
                                  <ArrowUpDown size={12} />
                                  Cambiar
                                </button>
                              ) : (
                                <button
                                  onClick={() => setShowUserPicker(extId)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-[#0a6ea9] text-white hover:bg-[#085d8f] rounded-md transition-colors"
                                >
                                  <UserPlus size={12} />
                                  Asignar
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Agentes ── */}
      {tab === 'agentes' && (
        <div className="space-y-4">
          {/* Summary cards */}
          {!loadingAgents && agents.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Disponibles', count: agents.filter((a) => {
                  const s = (a.status || '').toLowerCase();
                  return s.includes('available') || s.includes('idle') || s.includes('ok') || s.includes('ready');
                }).length, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: Wifi },
                { label: 'En llamada', count: agents.filter((a) => {
                  const s = (a.status || '').toLowerCase();
                  return s.includes('ring') || s.includes('call') || s.includes('busy') || s.includes('inuse');
                }).length, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: PhoneCall },
                { label: 'Pausa', count: agents.filter((a) => {
                  const s = (a.status || '').toLowerCase();
                  return s.includes('pause') || s.includes('break');
                }).length, color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-900/20', icon: Clock },
                { label: 'Offline', count: agents.filter((a) => {
                  const s = (a.status || '').toLowerCase();
                  return s.includes('offline') || s.includes('unavailable') || s.includes('logged');
                }).length, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', icon: WifiOff },
              ].map((card) => (
                <div key={card.label} className={`${card.bg} rounded-xl p-3 border border-slate-200 dark:border-slate-700`}>
                  <div className="flex items-center gap-2">
                    <card.icon size={16} className={card.color} />
                    <span className="text-xs text-slate-500 dark:text-slate-400">{card.label}</span>
                  </div>
                  <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.count}</p>
                </div>
              ))}
            </div>
          )}

          {/* Agents Table */}
          {loadingAgents ? (
            <TableSkeleton rows={5} cols={3} />
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Agente</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Extensión</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Estado</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Operador</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Pausa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-slate-400">
                          <Users size={32} className="mx-auto mb-2 opacity-50" />
                          No hay agentes conectados
                        </td>
                      </tr>
                    ) : (
                      agents.map((agent) => {
                        const agentId = String(agent.id || agent.agent || '');
                        const agentExt = String(agent.extension || agent.id || '');
                        // Buscar si esta extensión tiene operador asignado
                        const assignedExt = extensions.find(
                          (e) => getExtId(e) === agentExt || getExtLabel(e) === agentExt
                        );
                        const assignedUser = assignedExt?.assigned_user;

                        return (
                          <tr
                            key={agentId}
                            className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                          >
                            <td className="px-4 py-3">
                              <span className="font-medium text-slate-900 dark:text-white">
                                {agent.name || agent.agent || agentId}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-slate-600 dark:text-slate-300">
                                {agentExt}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                {getAgentStatusIcon(agent.status || '')}
                                <span className="text-slate-700 dark:text-slate-300">
                                  {getAgentStatusLabel(agent.status || '')}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {assignedUser ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-[#481163]/10 flex items-center justify-center">
                                    <User size={10} className="text-[#481163]" />
                                  </div>
                                  <span className="text-slate-700 dark:text-slate-300 text-xs">
                                    {assignedUser.nombre}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs italic">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {(() => {
                                const userId = assignedUser?.id;
                                const pausa = userId ? pausasData[userId] : null;
                                if (!pausa) return <span className="text-slate-400 text-xs italic">—</span>;
                                const mins = Math.floor((pausa.duracionSegundos || 0) / 60);
                                const segs = (pausa.duracionSegundos || 0) % 60;
                                const s = pausa.duracionSegundos || 0;
                                const labels: Record<string,string> = {bano:'Baño',almuerzo:'Almuerzo',descanso:'Descanso',reunion:'Reunión',capacitacion:'Capacitación',otro:'Otro'};
                                const color = s < 300 ? 'text-amber-600' : s < 900 ? 'text-orange-500' : s < 1800 ? 'text-orange-600' : 'text-red-500';
                                return (
                                  <span className={`text-xs ${color} transition-colors duration-500`}>
                                    {labels[pausa.tipo] || pausa.tipo} · {mins}:{String(segs).padStart(2,'0')}
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
