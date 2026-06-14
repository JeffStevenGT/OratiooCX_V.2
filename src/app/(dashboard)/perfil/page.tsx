/**
 * app/(dashboard)/perfil/page.tsx — Perfil de Usuario
 */

'use client';

import { useState, useEffect } from 'react';
import { User, Lock, CheckCircle2, Loader2, Mail, Shield, Globe, Clock } from 'lucide-react';
import Skeleton from '@/components/shared/Skeleton';
import { toast } from '@/components/shared/Toast';

type PerfilData = { nombre: string; email: string; rol: string; equipo: string; ultima_conexion: string; activo: boolean };

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(s => {
      if (s?.user) setPerfil({
        nombre: s.user.name || '',
        email: s.user.email || '',
        rol: s.user.role || '',
        equipo: s.user.team || '',
        ultima_conexion: s.user.ultima_conexion || '',
        activo: true,
      });
      setLoading(false);
    }).catch(() => { toast.error('Error al cargar el perfil'); setLoading(false); });
  }, []);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) { setMsg('Las contrasenas no coinciden'); return; }
    if (form.newPassword.length < 6) { setMsg('Minimo 6 caracteres'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/perfil/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current: form.currentPassword, new: form.newPassword }),
      });
      if (res.ok) { toast.success('Contraseña actualizada'); setMsg('Contrasena actualizada'); setForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }
      else { toast.error('Contraseña actual incorrecta'); setMsg('Contrasena actual incorrecta'); }
    } catch { toast.error('Error al cambiar contraseña'); setMsg('Error'); }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  if (loading) return <div className="animate-fade-in max-w-lg mx-auto"><Skeleton variant="detail" /></div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-lg">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><User size={22} className="text-[#0a6ea9]" />Perfil</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Tu información personal y configuración de cuenta</p>

      {msg && <div className={`px-3 py-2 rounded-lg text-xs ${msg === 'Contrasena actualizada' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg}</div>}

      {/* Info del usuario */}
      {perfil && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><User size={16} className="text-[#0a6ea9]" /> Informacion personal</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Nombre</p>
              <p className="text-sm font-medium">{perfil.nombre}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Email</p>
              <p className="text-sm font-medium truncate">{perfil.email}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Rol</p>
              <p className="text-sm font-medium capitalize">{perfil.rol.replace('_', ' ')}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Equipo</p>
              <p className="text-sm font-medium">{perfil.equipo || 'Sin equipo'}</p>
            </div>
          </div>
          {perfil.ultima_conexion && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Ultima conexion</p>
              <p className="text-sm font-medium">{new Date(perfil.ultima_conexion).toLocaleString('es-PE')}</p>
            </div>
          )}
        </div>
      )}

      {/* Cambiar contrasena */}
      <form onSubmit={changePassword} className="card space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Lock size={16} className="text-[#0a6ea9]" /> Cambiar contrasena</h3>
        <input type="password" placeholder="Contrasena actual" value={form.currentPassword} onChange={e => setForm({ ...form, currentPassword: e.target.value })}
          className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" required />
        <input type="password" placeholder="Nueva contrasena" value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })}
          className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" required />
        <input type="password" placeholder="Confirmar nueva contrasena" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
          className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" required />
        <button type="submit" disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-2 disabled:opacity-40">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Cambiar contrasena
        </button>
      </form>
      {/* ── Info ── */}
      <div className="mt-8 card-sm bg-gray-50 dark:bg-gray-800 dark:bg-[#1e1a2a] border-dashed border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a]">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">💡 ¿Cómo funciona?</h3>
        <ul className="space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
          <li>· Tu información personal. Cambia tu contraseña y revisa tu actividad reciente.</li>
        </ul>
      </div>
    </div>
  );
}
