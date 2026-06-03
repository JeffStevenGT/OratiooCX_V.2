/**
 * app/(dashboard)/usuarios/page.tsx — Gestión de Usuarios
 */

'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Loader2, Shield, Edit, X, Check, Globe } from 'lucide-react';

type Usuario = { id: number; email: string; nombre: string; rol: string; equipo: string | null; activo: boolean; supervisor_id: number | null };

const ROLES = ['asesor', 'supervisor', 'jefe_area', 'back_office', 'it', 'desarrollador'];
const EQUIPOS = ['Perú', 'España'];

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // Form crear
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', nombre: '', password: '', rol: 'asesor', equipo: '', supervisor_id: '' });
  const [saving, setSaving] = useState(false);

  // Edición inline
  const [editing, setEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Usuario> & { password?: string }>({});

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/usuarios');
      setUsuarios(await res.json());
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { fetchUsuarios(); }, []);

  const handleCreate = async () => {
    if (!form.email || !form.nombre || !form.password) return;
    setSaving(true);
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          equipo: form.equipo || null,
          supervisor_id: form.supervisor_id ? parseInt(form.supervisor_id) : null,
        }),
      });
      if (res.ok) {
        setMsg('Usuario creado');
        setShowForm(false);
        setForm({ email: '', nombre: '', password: '', rol: 'asesor', equipo: '', supervisor_id: '' });
        fetchUsuarios();
      } else {
        const err = await res.json();
        setMsg(err.error || 'Error');
      }
    } catch { setMsg('Error'); }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleSave = async (id: number) => {
    try {
      await fetch('/api/usuarios', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          ...editForm,
          equipo: editForm.equipo || null,
          supervisor_id: editForm.supervisor_id ? parseInt(String(editForm.supervisor_id)) : null,
        }),
      });
      setEditing(null);
      fetchUsuarios();
    } catch { /* */ }
  };

  const handleToggleActive = async (u: Usuario) => {
    await fetch('/api/usuarios', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, activo: !u.activo }),
    });
    fetchUsuarios();
  };

  // Filtrar supervisores para el dropdown
  const supervisores = usuarios.filter(u => u.rol === 'supervisor');

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a1030]">Usuarios</h1>
          <p className="text-sm text-[#7c757c] mt-0.5">{usuarios.length} usuarios</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5">
          <UserPlus size={12} /> Nuevo Usuario
        </button>
      </div>

      {msg && (
        <div className={`px-3 py-2 rounded-lg text-xs ${msg.startsWith('Usuario') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {msg}
        </div>
      )}

      {/* Form crear */}
      {showForm && (
        <div className="card-sm bg-[#f8f7fa] border-[#e0e0f0]">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              className="border border-[#e0e0f0] rounded-lg px-3 py-1.5 text-xs bg-white" />
            <input placeholder="Nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
              className="border border-[#e0e0f0] rounded-lg px-3 py-1.5 text-xs bg-white" />
            <input placeholder="Password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
              className="border border-[#e0e0f0] rounded-lg px-3 py-1.5 text-xs bg-white" />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}
              className="border border-[#e0e0f0] rounded-lg px-2.5 py-1.5 text-xs bg-white">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={form.equipo} onChange={e => setForm({ ...form, equipo: e.target.value })}
              className="border border-[#e0e0f0] rounded-lg px-2.5 py-1.5 text-xs bg-white">
              <option value="">Sin equipo</option>
              {EQUIPOS.map(eq => <option key={eq} value={eq}>{eq}</option>)}
            </select>
            <select value={form.supervisor_id} onChange={e => setForm({ ...form, supervisor_id: e.target.value })}
              className="border border-[#e0e0f0] rounded-lg px-2.5 py-1.5 text-xs bg-white">
              <option value="">Sin supervisor</option>
              {supervisores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCreate} disabled={saving}
              className="btn-primary flex items-center gap-1 text-xs px-3 py-1.5 disabled:opacity-40">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Crear
            </button>
            <button onClick={() => setShowForm(false)} className="btn-outline text-xs px-3 py-1.5">Cancelar</button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-[#b8b0b8]" /></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e8dce6] bg-[#f8f7fa]">
                <th className="table-header px-3 py-2.5 text-left">Nombre</th>
                <th className="table-header px-3 py-2.5 text-left">Email</th>
                <th className="table-header px-3 py-2.5 text-left">Rol</th>
                <th className="table-header px-3 py-2.5 text-left">Equipo</th>
                <th className="table-header px-3 py-2.5 text-center">Activo</th>
                <th className="table-header px-3 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} className={`border-b border-[#f0f0f8] ${!u.activo ? 'opacity-50' : ''}`}>
                  <td className="py-2.5 px-3 text-xs">
                    {editing === u.id ? (
                      <input value={editForm.nombre || u.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })}
                        className="border border-[#e0e0f0] rounded px-2 py-1 text-xs w-full" />
                    ) : u.nombre}
                  </td>
                  <td className="py-2.5 px-3 text-xs font-mono">{u.email}</td>
                  <td className="py-2.5 px-3 text-xs">
                    {editing === u.id ? (
                      <select value={editForm.rol || u.rol} onChange={e => setEditForm({ ...editForm, rol: e.target.value })}
                        className="border border-[#e0e0f0] rounded px-1 py-1 text-[10px]">
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        u.rol === 'desarrollador' ? 'bg-purple-100 text-purple-700' :
                        u.rol === 'jefe_area' ? 'bg-blue-100 text-blue-700' :
                        u.rol === 'supervisor' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{u.rol}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-xs">
                    {editing === u.id ? (
                      <select value={editForm.equipo || u.equipo || ''} onChange={e => setEditForm({ ...editForm, equipo: e.target.value })}
                        className="border border-[#e0e0f0] rounded px-1 py-1 text-[10px]">
                        <option value="">—</option>
                        {EQUIPOS.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                      </select>
                    ) : (u.equipo || '—')}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button onClick={() => handleToggleActive(u)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        u.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="py-2.5 px-3">
                    {editing === u.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleSave(u.id)} title="Guardar"
                          className="p-1 rounded hover:bg-emerald-50"><Check size={12} className="text-emerald-600" /></button>
                        <button onClick={() => setEditing(null)} title="Cancelar"
                          className="p-1 rounded hover:bg-red-50"><X size={12} className="text-red-500" /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditing(u.id); setEditForm({}); }}
                        className="p-1 rounded hover:bg-[#e8dce6]" title="Editar"><Edit size={12} className="text-[#7c757c]" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
