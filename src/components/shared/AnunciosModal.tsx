/**
 * components/shared/AnunciosModal.tsx — Modal de anuncios al entrar al proyecto
 */

'use client';

import { useState, useEffect } from 'react';
import { Megaphone, X, Gift, Star, AlertTriangle, Bell, PartyPopper, Loader2 } from 'lucide-react';

type Anuncio = {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: string;
  creador_nombre: string;
  created_at: string;
};

const ICONOS: Record<string, any> = {
  general: Bell,
  record_ventas: Star,
  festividad: PartyPopper,
  cambio_condiciones: AlertTriangle,
  cumpleanos: Gift,
};

const COLORES: Record<string, string> = {
  general: 'border-l-blue-500 bg-blue-50/50',
  record_ventas: 'border-l-amber-500 bg-amber-50/50',
  festividad: 'border-l-pink-500 bg-pink-50/50',
  cambio_condiciones: 'border-l-red-500 bg-red-50/50',
  cumpleanos: 'border-l-purple-500 bg-purple-50/50',
};

interface Props {
  proyectoId: number;
  onClose: () => void;
}

export default function AnunciosModal({ proyectoId, onClose }: Props) {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/anuncios/no-leidos?proyecto_id=${proyectoId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAnuncios(data);
        else setError(data.error || 'Error');
      })
      .catch(() => setError('Error al cargar anuncios'))
      .finally(() => setLoading(false));
  }, [proyectoId]);

  const handleEntrar = async () => {
    if (anuncios.length > 0) {
      const ids = anuncios.map(a => a.id);
      fetch('/api/anuncios/marcar-leido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      }).catch(() => {});
    }
    onClose();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 text-center">
          <Loader2 size={32} className="animate-spin mx-auto text-purple-600" />
          <p className="mt-4 text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  // Sin anuncios → saltar directo
  if (!loading && anuncios.length === 0) {
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <Megaphone size={22} className="text-purple-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Anuncios</h2>
            <span className="text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5">
              {anuncios.length} nuevo{anuncios.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-8 py-4 space-y-3">
          {anuncios.map(a => {
            const Icono = ICONOS[a.tipo] || Bell;
            const colorClase = COLORES[a.tipo] || COLORES.general;
            return (
              <div
                key={a.id}
                className={`border-l-4 rounded-lg p-4 ${colorClase} dark:bg-opacity-10`}
              >
                <div className="flex items-start gap-3">
                  <Icono size={18} className="mt-0.5 text-gray-600 dark:text-gray-300" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
                      {a.titulo}
                    </h3>
                    {a.mensaje && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-line">
                        {a.mensaje}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-2">
                      {a.creador_nombre || 'Sistema'} ·{' '}
                      {new Date(a.created_at).toLocaleDateString('es-ES', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={handleEntrar}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Entrar al CRM
          </button>
        </div>
      </div>
    </div>
  );
}
