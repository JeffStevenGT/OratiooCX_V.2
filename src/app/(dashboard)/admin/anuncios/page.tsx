/**
 * app/(dashboard)/admin/anuncios/page.tsx — Gestión de Anuncios
 */

'use client';

import { useState, useEffect } from 'react';
import { Megaphone, Plus, Trash2, Send, Loader2, X, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/components/shared/Toast';

const ROLES = [
  { key: 'asesor', label: 'Asesor' },
  { key: 'supervisor', label: 'Supervisor' },
  { key: 'jefe_area', label: 'Jefe Área' },
  { key: 'back_office', label: 'Back Office' },
  { key: 'auditor_calidad', label: 'Auditor Calidad' },
  { key: 'it', label: 'IT' },
  { key: 'desarrollador', label: 'Desarrollador' },
];

const TIPOS = [
  { key: 'general', label: 'General' },
  { key: 'record_ventas', label: 'Récord Ventas' },
  { key: 'festividad', label: 'Festividad' },
  { key: 'cambio_condiciones', label: 'Cambio Condiciones' },
  { key: 'cumpleanos', label: 'Cumpleaños' },
];

export default function AnunciosAdminPage() {
  const [anuncios, setAnuncios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [tipo, setTipo] = useState('general');
  const [rolesVisibles, setRolesVisibles] = useState<string[]>(
    ROLES.map(r => r.key)
  );

  const fetchAnuncios = () => {
    setLoading(true);
    fetch('/api/anuncios?activos=false')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAnuncios(data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAnuncios(); }, []);

  const toggleRol = (key: string) => {
    setRolesVisibles(prev =>
      prev.includes(key) ? prev.filter(r => r !== key) : [...prev, key]
    );
  };

  const handleCreate = async () => {
    if (!titulo.trim()) return toast.error('Escribe un título');
    setSending(true);
    try {
      const res = await fetch('/api/anuncios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: 1,
          titulo: titulo.trim(),
          mensaje: mensaje.trim(),
          tipo,
          roles_visibles: rolesVisibles,
        }),
      });
      if (res.ok) {
        toast.success('Anuncio publicado');
        setTitulo(''); setMensaje(''); setTipo('general');
        setShowForm(false);
        fetchAnuncios();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error');
      }
    } catch {
      toast.error('Error al publicar');
    }
    setSending(false);
  };

  const toggleActivo = async (id: number, activo: boolean) => {
    await fetch('/api/anuncios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, activo }),
    });
    fetchAnuncios();
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Megaphone size={22} className="text-purple-600" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Anuncios</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancelar' : 'Nuevo anuncio'}
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Título</label>
              <input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Ej: ¡Récord de ventas!"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Mensaje</label>
              <textarea
                value={mensaje}
                onChange={e => setMensaje(e.target.value)}
                placeholder="Detalles del anuncio..."
                rows={3}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                <select
                  value={tipo}
                  onChange={e => setTipo(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm"
                >
                  {TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Visible para: {rolesVisibles.length} roles
              </label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map(r => (
                  <button
                    key={r.key}
                    onClick={() => toggleRol(r.key)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      rolesVisibles.includes(r.key)
                        ? 'bg-purple-100 text-purple-700 border border-purple-300'
                        : 'bg-gray-100 text-gray-400 border border-gray-200'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={sending}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Publicar anuncio
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-gray-400" /></div>
      ) : (
        <div className="space-y-3">
          {anuncios.map(a => (
            <div
              key={a.id}
              className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 ${
                !a.activo ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                      {TIPOS.find(t => t.key === a.tipo)?.label || a.tipo}
                    </span>
                    <span className="text-xs text-gray-400">
                      {a.creador_nombre} · {new Date(a.created_at).toLocaleDateString('es-ES')}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm">{a.titulo}</h3>
                  {a.mensaje && <p className="text-xs text-gray-500 mt-1">{a.mensaje}</p>}
                  <div className="flex gap-1 mt-2">
                    {a.roles_visibles?.map((r: string) => (
                      <span key={r} className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
                        {ROLES.find(ro => ro.key === r)?.label || r}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => toggleActivo(a.id, !a.activo)}
                  className="text-gray-400 hover:text-gray-600"
                  title={a.activo ? 'Desactivar' : 'Activar'}
                >
                  {a.activo ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
