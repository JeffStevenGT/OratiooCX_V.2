/**
 * app/login/page.tsx — Login Page
 */

'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    await signIn('credentials', {
      email: form.email,
      password: form.password,
      callbackUrl: '/admin',
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#481163] to-[#2d0a40] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-6">
          <svg viewBox="0 0 123 19" className="h-6 w-auto mx-auto mb-2" style={{ filter: 'brightness(0)' }}>
            <path d="M26.511 7.841C26.369 6.9 26.072 5.922 25.552 4.988C25.423 4.759..."/>
          </svg>
          <h1 className="text-lg font-bold text-[#1a1030]">Oratioo CX</h1>
          <p className="text-xs text-[#7c757c] mt-1">CRM omnicanal</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4 text-sm text-red-600 animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[#7c757c] mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-[#e8dce6] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a6ea9]/20 focus:border-[#0a6ea9]"
              placeholder="admin@oratioo.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-[#7c757c] mb-1">Contraseña</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border border-[#e8dce6] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a6ea9]/20 focus:border-[#0a6ea9]"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0a6ea9] hover:bg-[#085d8f] text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin mx-auto" />
            ) : (
              'Iniciar sesión'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
