/**
 * app/login/page.tsx — Login Page
 */

'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', remember: false });

  // Cargar email guardado
  useEffect(() => {
    const saved = localStorage.getItem('oratioo_email');
    if (saved) setForm(f => ({ ...f, email: saved, remember: true }));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Guardar/borrar email
    if (form.remember) localStorage.setItem('oratioo_email', form.email);
    else localStorage.removeItem('oratioo_email');

    const result = await signIn('credentials', {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    if (result?.error) {
      setError('Email o contraseña incorrectos');
      setLoading(false);
    } else {
      router.push('/admin');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#481163] to-[#2d0a40] p-4">
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl w-full max-w-sm p-8 animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#0a6ea9] rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-lg font-bold">O</span>
          </div>
          <h1 className="text-xl font-bold text-[#1a1030]">Oratioo CX</h1>
          <p className="text-xs text-[#7c757c] mt-1">CRM Omnicanal</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-xs text-red-600 animate-fade-in flex items-center gap-2">
            <span className="text-red-400">⚠</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-medium text-[#7c757c] uppercase tracking-wider mb-1.5">Email</label>
            <input
              type="email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full border border-[#e8dce6] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a6ea9]/20 focus:border-[#0a6ea9] transition-all"
              placeholder="admin@oratioo.com"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[#7c757c] uppercase tracking-wider mb-1.5">Contraseña</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full border border-[#e8dce6] rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a6ea9]/20 focus:border-[#0a6ea9] transition-all"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b8b0b8] hover:text-[#7c757c]">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Recordarme */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="remember" checked={form.remember}
              onChange={e => setForm({ ...form, remember: e.target.checked })}
              className="w-3.5 h-3.5 rounded border-[#d0d0e0] text-[#0a6ea9]" />
            <label htmlFor="remember" className="text-xs text-[#7c757c]">Recordar email</label>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-[#0a6ea9] hover:bg-[#085d8f] text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Iniciar sesión'}
          </button>
        </form>

        <p className="text-[10px] text-[#b8b0b8] text-center mt-6">
          Oratioo CX v3.0 · submaster
        </p>
      </div>
    </div>
  );
}
