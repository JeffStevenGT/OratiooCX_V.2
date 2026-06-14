/**
 * components/shared/NotificationBadge.tsx — Badge de notificaciones
 * ==================================================================
 * Polling cada 60s. Muestra conteo de leads nuevos, por vencer, sin asignar.
 */

'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';

type Props = { userId?: string; userRole?: string };

export default function NotificationBadge({ userId, userRole }: Props) {
  const [count, setCount] = useState(0);
  const [tooltip, setTooltip] = useState('');

  useEffect(() => {
    if (!userId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/pipeline/notifications?user_id=${userId}&rol=${userRole}`);
        const data = await res.json();
        // Sumar notificaciones relevantes según rol
        if (userRole === 'asesor') {
          const nuevos = data.nuevos || 0;
          const porVencer = data.porVencer || 0;
          setCount(nuevos + porVencer);
          const parts: string[] = [];
          if (nuevos) parts.push(`${nuevos} nuevos`);
          if (porVencer) parts.push(`${porVencer} por vencer`);
          setTooltip(parts.join(', '));
        } else {
          const sinAsignar = data.sinAsignar || 0;
          const liberados = data.liberados || 0;
          setCount(sinAsignar + liberados);
          const parts: string[] = [];
          if (sinAsignar) parts.push(`${sinAsignar} sin asignar`);
          if (liberados) parts.push(`${liberados} liberados`);
          setTooltip(parts.join(', '));
        }
      } catch { /* */ }
    };

    poll();
    const interval = setInterval(poll, 60000);
    return () => clearInterval(interval);
  }, [userId, userRole]);

  if (count === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500 rounded-full text-white text-[10px] font-bold animate-pulse"
      title={tooltip}>
      <Bell size={10} />
      {count}
    </div>
  );
}
