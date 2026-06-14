/**
 * components/shared/OfflineIndicator.tsx — Indicador de conexión
 * Muestra un banner cuando no hay internet.
 */

'use client';

import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineIndicator() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    setOffline(!navigator.onLine);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-pulse">
      <WifiOff className="w-4 h-4" />
      Sin conexión — los cambios se guardan localmente
    </div>
  );
}
