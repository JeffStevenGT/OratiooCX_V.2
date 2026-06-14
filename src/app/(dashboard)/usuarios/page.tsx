/**
 * app/(dashboard)/usuarios/page.tsx — Árbol jerárquico 3 niveles
 * Equipo → Jefe → Supervisor → Asesor (colapsable por nivel)
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { UserPlus, Loader2, Shield, Edit, X, Check, Search, ChevronDown, ChevronRight, Trash2, Users, Clock, User, UserCheck } from 'lucide-react';
import { TableSkeleton } from '@/components/shared/Skeleton';
import { toast } from '@/components/shared/Toast';

type Usuario = { id: number; email: string; nombre: string; rol: string; equipo: string | null; activo: boolean; supervisor_id: number | null; ultima_conexion: string | null };
const ROLES = ['asesor', 'supervisor', 'jefe_area', 'back_office', 'it', 'auditor_calidad', 'desarrollador'];
const EQUIPO_ORDER = ['Administración', 'España', 'Perú'];

function eqLabel(eq: string | null): string { return eq || 'Administración'; }
function eqOrder(eq: string | null): number { const i = EQUIPO_ORDER.indexOf(eq || ''); return i >= 0 ? i : 99; }

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set()); // "eq", "jefe-8", "sup-10"

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', nombre: '', password: '', rol: 'asesor', equipo: '', supervisor_id: '', jefe_id: '', equipos: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Usuario> & { password?: string }>({});

  const fetchUsuarios = async () => {
    setLoading(true);
    try { const r = await fetch('/api/usuarios'); if (!r.ok) throw new Error(''); setUsuarios(await r.json()); }
    catch { toast.error('Error al cargar usuarios'); }
    setLoading(false);
  };
  useEffect(() => { fetchUsuarios(); }, []);

  const handleCreate = async () => {
    if (!form.email || !form.nombre || !form.password) return;
    setSaving(true);
    try {
      let supervisor_id = form.supervisor_id ? parseInt(form.supervisor_id) : null;
      let equipo = form.equipo || null;

      // jefe_area: usa el primer país como equipo principal
      if (form.rol === 'jefe_area') {
        equipo = form.equipos[0] || null;
        supervisor_id = null;
      }
      // supervisor: supervisor_id = jefe_id, equipo = nombre del equipo
      if (form.rol === 'supervisor') {
        supervisor_id = form.jefe_id ? parseInt(form.jefe_id) : null;
        // Inherit país from jefe
        if (form.jefe_id && !equipo) {
          const jefe = usuarios.find(u => u.id === parseInt(form.jefe_id));
          if (jefe) equipo = jefe.equipo;
        }
      }
      // asesor: equipo y jefe heredados del supervisor
      if (form.rol === 'asesor' && supervisor_id) {
        const sup = usuarios.find(u => u.id === supervisor_id);
        if (sup) {
          equipo = sup.equipo;
        }
      }
      // it, back_office, auditor_calidad: equipo asignado al país

      const r = await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.email, nombre: form.nombre, password: form.password, rol: form.rol, equipo, supervisor_id }) });
      if (r.ok) { toast.success('Creado'); setShowForm(false); setForm({ email: '', nombre: '', password: '', rol: 'asesor', equipo: '', supervisor_id: '', jefe_id: '', equipos: [] }); fetchUsuarios(); }
      else { const e = await r.json(); toast.error(e.error); }
    } catch { toast.error('Error'); }
    setSaving(false);
  };

  const handleSave = async (id: number) => {
    try {
      const p: any = { id };
      if (editForm.nombre !== undefined) p.nombre = editForm.nombre;
      if (editForm.rol !== undefined) p.rol = editForm.rol;
      if (editForm.equipo !== undefined) p.equipo = editForm.equipo || null;
      if (editForm.supervisor_id !== undefined) p.supervisor_id = editForm.supervisor_id || null;
      if (editForm.password) p.password = editForm.password;
      const r = await fetch('/api/usuarios', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      toast.success('Actualizado'); setEditing(null); fetchUsuarios();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleToggleActive = async (u: Usuario) => {
    try {
      const r = await fetch('/api/usuarios', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, activo: !u.activo }) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      toast.success(u.activo ? 'Suspendido' : 'Reactivado'); fetchUsuarios();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (u: Usuario, hard: boolean) => {
    if (!confirm(hard ? `¿Eliminar PERMANENTEMENTE a ${u.nombre}?` : `¿Suspender a ${u.nombre}?`)) return;
    try {
      const r = await fetch('/api/usuarios', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, hard }) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      toast.success(hard ? 'Eliminado' : 'Suspendido'); fetchUsuarios();
    } catch (e: any) { toast.error(e.message); }
  };

  const toggle = (k: string) => { const n = new Set(collapsed); n.has(k) ? n.delete(k) : n.add(k); setCollapsed(n); };
  const isOpen = (k: string) => !collapsed.has(k);

  const supervisores = usuarios.filter(u => u.rol === 'supervisor' || u.rol === 'jefe_area');
  const equiposDisp = [...new Set(usuarios.map(u => u.equipo).filter(Boolean))] as string[];

  // Filtro + árbol
  const tree = useMemo(() => {
    let list = usuarios;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.rol.includes(q) || (u.equipo || '').toLowerCase().includes(q));
    }
    const byId = new Map<number, Usuario>();
    for (const u of list) byId.set(u.id, u);

    // Agrupar por equipo
    const grupos = new Map<string, { eq: string; jefes: Usuario[]; sinJefe: Usuario[] }>();
    for (const u of list) {
      const eq = eqLabel(u.equipo);
      if (!grupos.has(eq)) grupos.set(eq, { eq, jefes: [], sinJefe: [] });
      const g = grupos.get(eq)!;
      if (u.rol === 'jefe_area') g.jefes.push(u);
      else if (!u.supervisor_id && u.rol !== 'jefe_area') g.sinJefe.push(u);
    }

    // Para cada jefe, encontrar sus supervisores
    const jefeConSupervisores = grupos.get('Perú')?.jefes.map(j => {
      const sups = list.filter(u => u.supervisor_id === j.id && u.rol === 'supervisor');
      return { jefe: j, supervisores: sups.map(s => {
        const ases = list.filter(u => u.supervisor_id === s.id && u.rol === 'asesor');
        return { sup: s, asesores: ases };
      })};
    }) || [];

    // También para España
    const jefeConSupervisoresEsp = grupos.get('España')?.jefes.map(j => {
      const sups = list.filter(u => u.supervisor_id === j.id && u.rol === 'supervisor');
      return { jefe: j, supervisores: sups.map(s => {
        const ases = list.filter(u => u.supervisor_id === s.id && u.rol === 'asesor');
        return { sup: s, asesores: ases };
      })};
    }) || [];

    return [...grupos.entries()]
      .sort(([a], [b]) => eqOrder(a === 'Sin equipo' ? null : a) - eqOrder(b === 'Sin equipo' ? null : b))
      .map(([eq, g]) => ({
        eq,
        sinJefe: g.sinJefe,
        jefesTree: eq === 'Perú' ? jefeConSupervisores : eq === 'España' ? jefeConSupervisoresEsp : g.jefes.map(j => ({ jefe: j, supervisores: list.filter(u => u.supervisor_id === j.id && u.rol === 'supervisor').map(s => ({ sup: s, asesores: list.filter(u => u.supervisor_id === s.id && u.rol === 'asesor') })) })),
      }));
  }, [usuarios, search]);

  // ── Helpers ──
  const RolBadge = ({ rol }: { rol: string }) => {
    const c: Record<string, string> = {
      desarrollador: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
      jefe_area: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      supervisor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
      it: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
      back_office: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300',
      auditor_calidad: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
      asesor: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };
    return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${c[rol] || c.asesor}`}>{rol}</span>;
  };

  const Actions = ({ u }: { u: Usuario }) => (
    <div className="flex items-center gap-0.5 ml-auto shrink-0">
      {editing === u.id ? (
        <>
          <button onClick={() => handleSave(u.id)} className="p-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900"><Check size={11} className="text-emerald-600" /></button>
          <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900"><X size={11} className="text-red-500" /></button>
        </>
      ) : (
        <>
          <button onClick={() => { setEditing(u.id); setEditForm({}); }} className="p-1 rounded hover:bg-[#e8dce6] dark:hover:bg-[#2a1f3a]" title="Editar"><Edit size={11} className="text-gray-500 dark:text-gray-400" /></button>
          <button onClick={() => handleDelete(u, false)} className="p-1 rounded hover:bg-amber-50 dark:hover:bg-amber-900" title="Suspender"><Clock size={11} className="text-amber-500" /></button>
          <button onClick={() => handleDelete(u, true)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900" title="Eliminar"><Trash2 size={11} className="text-red-500" /></button>
        </>
      )}
    </div>
  );

  const UserRow = ({ u, depth }: { u: Usuario; depth: number }) => {
    const supOptions = usuarios.filter(s => s.rol === 'supervisor' || s.rol === 'jefe_area');
    if (editing === u.id) {
      return (
        <div className="flex items-center border-b border-[#fcf8ff] dark:border-[#2a1f3a] bg-gray-50 dark:bg-gray-800 dark:bg-[#1e1a2a]" style={{ paddingLeft: `${depth * 24 + 12}px` }}>
          <User size={11} className="text-gray-400 dark:text-gray-500 shrink-0 mr-2" />
          <div className="flex-1 flex items-center gap-2 py-2 text-xs">
            <input value={editForm.nombre || u.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })}
              className="border border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a] dark:bg-[#121218] dark:text-white rounded px-2 py-1 text-xs w-32" />
            <select value={editForm.rol || u.rol} onChange={e => setEditForm({ ...editForm, rol: e.target.value })}
              className="border border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a] dark:bg-[#121218] dark:text-white rounded px-1 py-1 text-[10px]">
              {ROLES.map(r => <option key={r} value={r}>{r.replace('_',' ')}</option>)}
            </select>
            <select value={editForm.equipo !== undefined ? (editForm.equipo || '') : (u.equipo || '')} onChange={e => setEditForm({ ...editForm, equipo: e.target.value })}
              className="border border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a] dark:bg-[#121218] dark:text-white rounded px-1 py-1 text-[10px]">
              <option value="">Sin equipo</option>
              {['Administración','Perú','España'].map(eq => <option key={eq} value={eq}>{eq}</option>)}
            </select>
            <select value={editForm.supervisor_id !== undefined ? String(editForm.supervisor_id || '') : String(u.supervisor_id || '')} onChange={e => setEditForm({ ...editForm, supervisor_id: e.target.value ? parseInt(e.target.value) : null })}
              className="border border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a] dark:bg-[#121218] dark:text-white rounded px-1 py-1 text-[10px]">
              <option value="">Sin supervisor</option>
              {supOptions.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.equipo})</option>)}
            </select>
            <input type="password" placeholder="Nueva clave" value={editForm.password || ''}
              onChange={e => setEditForm({ ...editForm, password: e.target.value })}
              className="border border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a] dark:bg-[#121218] dark:text-white rounded px-2 py-1 text-[10px] w-24" />
          </div>
          <Actions u={u} />
        </div>
      );
    }
    return (
    <div className={`flex items-center border-b border-[#f0f0f8] dark:border-[#2a1f3a] hover:bg-[#faf9fd] dark:hover:bg-[#1a1628] ${!u.activo ? 'opacity-50' : ''}`} style={{ paddingLeft: `${depth * 24 + 12}px` }}>
      <User size={11} className="text-gray-400 dark:text-gray-500 shrink-0 mr-2" />
      <span className="flex-1 text-xs text-gray-900 dark:text-white dark:text-white">{u.nombre}</span>
      <span className="w-44 text-[11px] text-gray-500 dark:text-gray-400 font-mono truncate">{u.email}</span>
      <span className="w-24"><RolBadge rol={u.rol} /></span>
      <span className="w-16 text-xs text-gray-500 dark:text-gray-400">{u.equipo || '—'}</span>
      <span className="w-20">
        <button onClick={() => handleToggleActive(u)}
          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${u.activo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
          {u.activo ? 'Activo' : 'Suspendido'}
        </button>
      </span>
      <span className="w-28 text-[10px] text-gray-400 dark:text-gray-500">{u.ultima_conexion ? new Date(u.ultima_conexion).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
      <Actions u={u} />
    </div>
  );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white dark:text-white flex items-center gap-2"><Shield size={22} className="text-[#0a6ea9]" />Usuarios</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{usuarios.length} usuarios en {tree.length} equipos</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5">
          <UserPlus size={12} /> Nuevo
        </button>
      </div>

      <div className="card-sm flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a] dark:bg-[#121218] dark:text-white rounded-lg pl-8 pr-3 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-[#0a6ea9]/30" />
        </div>
      </div>

      {showForm && (
        <div className="card-sm bg-gray-50 dark:bg-gray-800 dark:bg-[#1e1a2a]">
          <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white dark:text-white">Nuevo Usuario</h3>

          {/* Rol selector */}
          <div className="mb-3">
            <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">Rol</label>
            <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value, supervisor_id: '', jefe_id: '', equipos: [], equipo: '' })}
              className="border border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a] dark:bg-[#121218] dark:text-white rounded-lg px-2.5 py-1.5 text-xs w-full max-w-xs">
              {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>

          {/* Campos comunes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <div>
              <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">Nombre completo</label>
              <input placeholder="Nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                className="border border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a] dark:bg-[#121218] dark:text-white rounded-lg px-3 py-1.5 text-xs w-full" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">Correo</label>
              <input placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="border border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a] dark:bg-[#121218] dark:text-white rounded-lg px-3 py-1.5 text-xs w-full" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">Contraseña</label>
              <input placeholder="Contraseña" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                className="border border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a] dark:bg-[#121218] dark:text-white rounded-lg px-3 py-1.5 text-xs w-full" />
            </div>
          </div>

          {/* Campos según rol */}
          <div className="flex flex-wrap items-end gap-2 mb-3">
            {/* jefe_area: país(es) — multi-select */}
            {form.rol === 'jefe_area' && (
              <div>
                <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">País asignado (puede ser varios)</label>
                <div className="flex flex-wrap gap-1">
                  {['Perú', 'España'].map(pais => {
                    const sel = form.equipos.includes(pais);
                    return (
                      <button key={pais} type="button" onClick={() => setForm({ ...form, equipos: sel ? form.equipos.filter(e => e !== pais) : [...form.equipos, pais] })}
                        className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                          sel ? 'bg-[#0a6ea9] text-white border-[#0a6ea9]' : 'bg-white dark:bg-[#121218] text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a]'
                        }`}>{pais}</button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* supervisor: jefe_area + país + equipo */}
            {form.rol === 'supervisor' && (
              <>
                <div>
                  <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">Jefe de área</label>
                  <select value={form.jefe_id} onChange={e => setForm({ ...form, jefe_id: e.target.value })}
                    className="border border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a] dark:bg-[#121218] dark:text-white rounded-lg px-2.5 py-1.5 text-xs">
                    <option value="">Seleccionar jefe</option>
                    {usuarios.filter(u => u.rol === 'jefe_area').map(j => <option key={j.id} value={j.id}>{j.nombre} ({j.equipo})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">País</label>
                  <select value={form.equipo} onChange={e => setForm({ ...form, equipo: e.target.value })}
                    className="border border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a] dark:bg-[#121218] dark:text-white rounded-lg px-2.5 py-1.5 text-xs">
                    <option value="">Seleccionar país</option>
                    {['Perú', 'España'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">Nombre del equipo</label>
                  <input placeholder="Ej: Ventas Lima" value={form.equipo || ''}
                    onChange={e => setForm({ ...form, equipo: e.target.value })}
                    className="border border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a] dark:bg-[#121218] dark:text-white rounded-lg px-3 py-1.5 text-xs" />
                </div>
              </>
            )}

            {/* asesor: supervisor (país, equipo y jefe heredados) */}
            {form.rol === 'asesor' && (
              <div>
                <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">Supervisor</label>
                <select value={form.supervisor_id} onChange={e => setForm({ ...form, supervisor_id: e.target.value })}
                  className="border border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a] dark:bg-[#121218] dark:text-white rounded-lg px-2.5 py-1.5 text-xs">
                  <option value="">Seleccionar supervisor</option>
                  {usuarios.filter(u => u.rol === 'supervisor').map(s => {
                    const jefe = usuarios.find(u => u.id === s.supervisor_id);
                    return <option key={s.id} value={s.id}>{s.nombre} — {s.equipo} {jefe ? `(Jefe: ${jefe.nombre})` : ''}</option>;
                  })}
                </select>
              </div>
            )}

            {/* it, back_office: país */}
            {(form.rol === 'it' || form.rol === 'back_office') && (
              <div>
                <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">País asignado</label>
                <select value={form.equipo} onChange={e => setForm({ ...form, equipo: e.target.value })}
                  className="border border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a] dark:bg-[#121218] dark:text-white rounded-lg px-2.5 py-1.5 text-xs">
                  <option value="">Seleccionar país</option>
                  {['Administración', 'Perú', 'España'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}

            {/* auditor_calidad: equipos (multi-select) */}
            {form.rol === 'auditor_calidad' && (
              <div>
                <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">Equipos asignados</label>
                <div className="flex flex-wrap gap-1">
                  {['Todos', 'Perú', 'España'].map(eq => {
                    const sel = form.equipos.includes(eq);
                    return (
                      <button key={eq} type="button" onClick={() => {
                        if (eq === 'Todos') setForm({ ...form, equipos: sel ? [] : ['Todos'] });
                        else setForm({ ...form, equipos: sel ? form.equipos.filter(e => e !== eq) : [...form.equipos.filter(e => e !== 'Todos'), eq] });
                      }}
                        className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                          sel ? 'bg-[#0a6ea9] text-white border-[#0a6ea9]' : 'bg-white dark:bg-[#121218] text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a]'
                        }`}>{eq}</button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleCreate} disabled={saving} className="btn-primary flex items-center gap-1 text-xs px-3 py-1.5 disabled:opacity-40">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Crear
            </button>
            <button onClick={() => setShowForm(false)} className="btn-outline text-xs px-3 py-1.5">Cancelar</button>
          </div>
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        {loading ? <TableSkeleton rows={10} cols={7} /> : tree.length === 0 ? (
          <div className="text-center py-16">
            <Shield size={48} className="text-gray-400 dark:text-gray-500 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No se encontraron usuarios</p>
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5 mx-auto mt-4"><UserPlus size={12} /> Nuevo</button>
          </div>
        ) : (
          tree.map(grupo => {
            const eqKey = `eq-${grupo.eq}`;
            const open = isOpen(eqKey);
            return (
              <div key={grupo.eq}>
                {/* ── Equipo ── */}
                <button onClick={() => toggle(eqKey)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 dark:bg-[#1e1a2a] border-b border-gray-200 dark:border-gray-700 dark:border-[#2a1f3a] hover:bg-[#f0ecf0] dark:hover:bg-[#252035]">
                  {open ? <ChevronDown size={14} className="text-gray-500 dark:text-gray-400" /> : <ChevronRight size={14} className="text-gray-500 dark:text-gray-400" />}
                  <Users size={14} className="text-[#0a6ea9]" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white dark:text-white">{grupo.eq}</span>
                </button>

                {open && (
                  <div>
                    {/* Jefes con sus supervisores anidados */}
                    {grupo.jefesTree.map(({ jefe, supervisores: sups }) => {
                      const jKey = `jefe-${jefe.id}`;
                      const jOpen = isOpen(jKey);
                      return (
                        <div key={jefe.id}>
                          <div className="flex items-center border-b border-[#f0f0f8] dark:border-[#2a1f3a] hover:bg-[#faf9fd] dark:hover:bg-[#1a1628] pl-6">
                            <button onClick={() => toggle(jKey)} className="py-2 pr-1 text-gray-400 dark:text-gray-500">
                              {jOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </button>
                            <UserCheck size={13} className="text-[#0a6ea9] shrink-0 mr-2" />
                            <span className="flex-1 text-xs font-medium text-gray-900 dark:text-white dark:text-white">{jefe.nombre}</span>
                            <span className="w-44 text-[11px] text-gray-500 dark:text-gray-400 font-mono truncate">{jefe.email}</span>
                            <span className="w-24"><RolBadge rol={jefe.rol} /></span>
                            <span className="w-16 text-xs text-gray-500 dark:text-gray-400">{jefe.equipo || '—'}</span>
                            <span className="w-20 text-center">
                              <button onClick={() => handleToggleActive(jefe)}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${jefe.activo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                                {jefe.activo ? 'Activo' : 'Suspendido'}
                              </button>
                            </span>
                            <span className="w-28 text-[10px] text-gray-400 dark:text-gray-500">{jefe.ultima_conexion ? new Date(jefe.ultima_conexion).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                            <Actions u={jefe} />
                          </div>

                          {jOpen && sups.map(({ sup, asesores }) => {
                            const sKey = `sup-${sup.id}`;
                            const sOpen = isOpen(sKey);
                            return (
                              <div key={sup.id}>
                                <div className="flex items-center border-b border-[#f0f0f8] dark:border-[#2a1f3a] hover:bg-[#faf9fd] dark:hover:bg-[#1a1628] pl-12">
                                  <button onClick={() => toggle(sKey)} className="py-2 pr-1 text-gray-400 dark:text-gray-500">
                                    {sOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  </button>
                                  <UserCheck size={12} className="text-emerald-500 shrink-0 mr-2" />
                                  <span className="flex-1 text-xs text-gray-900 dark:text-white dark:text-white">{sup.nombre}</span>
                                  <span className="w-44 text-[11px] text-gray-500 dark:text-gray-400 font-mono truncate">{sup.email}</span>
                                  <span className="w-24"><RolBadge rol={sup.rol} /></span>
                                  <span className="w-16 text-xs text-gray-500 dark:text-gray-400">{sup.equipo || '—'}</span>
                                  <span className="w-20 text-center">
                                    <button onClick={() => handleToggleActive(sup)}
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sup.activo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                                      {sup.activo ? 'Activo' : 'Suspendido'}
                                    </button>
                                  </span>
                                  <span className="w-28 text-[10px] text-gray-400 dark:text-gray-500">{sup.ultima_conexion ? new Date(sup.ultima_conexion).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                                  <Actions u={sup} />
                                </div>

                                {sOpen && asesores.map(a => (
                                  <UserRow key={a.id} u={a} depth={4} />
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}

                    {/* Usuarios sin jefe */}
                    {grupo.sinJefe.map(u => <UserRow key={u.id} u={u} depth={1} />)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {/* ── Info ── */}
      <div className="mt-8 card-sm bg-gray-50 dark:bg-gray-800 dark:bg-[#1e1a2a] border-dashed border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a]">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">💡 ¿Cómo funciona?</h3>
        <ul className="space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
          <li>· Árbol jerárquico: Equipo → Jefe → Supervisor → Asesor. Usa los botones [+] para expandir. Edita, suspende o elimina usuarios según tu rol.</li>
        </ul>
      </div>
    </div>
  );
}
