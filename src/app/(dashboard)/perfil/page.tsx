/**
 * app/(dashboard)/perfil/page.tsx — Perfil de Usuario
 */

'use client';

import { useState } from 'react';
import { User, Lock, CheckCircle2, Loader2 } from 'lucide-react';

export default function PerfilPage() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) { setMsg('Las contraseñas no coinciden'); return; }
    if (form.newPassword.length < 6) { setMsg('Mínimo 6 caracteres'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/perfil/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current: form.currentPassword, new: form.newPassword }),
      });
      if (res.ok) {
        setMsg('Contraseña actualizada');
        setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setMsg('Contraseña actual incorrecta');
      }
    } catch { setMsg('Error'); }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-md">
      <h1 className="text-xl font-bold text-[#1a1030]">Perfil</h1>

      {msg && (
        <div className={`px-3 py-2 rounded-lg text-xs ${msg === 'Contraseña actualizada' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {msg}
        </div>
      )}

      <form onSubmit={changePassword} className="card space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Lock size={16} className="text-[#0a6ea9]" /> Cambiar contraseña</h3>
        <input type="password" placeholder="Contraseña actual" value={form.currentPassword}
          onChange={e => setForm({ ...form, currentPassword: e.target.value })}
          className="w-full border border-[#e0e0f0] rounded-lg px-3 py-2 text-sm" required />
        <input type="password" placeholder="Nueva contraseña" value={form.newPassword}
          onChange={e => setForm({ ...form, newPassword: e.target.value })}
          className="w-full border border-[#e0e0f0] rounded-lg px-3 py-2 text-sm" required />
        <input type="password" placeholder="Confirmar nueva contraseña" value={form.confirmPassword}
          onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
          className="w-full border border-[#e0e0f0] rounded-lg px-3 py-2 text-sm" required />
        <button type="submit" disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-2 disabled:opacity-40">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Cambiar contraseña
        </button>
      </form>
    </div>
  );
}
