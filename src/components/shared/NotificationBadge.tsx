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

  useEffect(() => {
    if (!userId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/pipeline/notifications?user_id=${userId}&rol=${userRole}`);
        const data = await res.json();
        // Sumar notificaciones relevantes según rol
        if (userRole === 'asesor') {
          setCount((data.nuevos || 0) + (data.porVencer || 0));
        } else {
          setCount((data.sinAsignar || 0) + (data.liberados || 0));
        }
      } catch { /* */ }
    };

    poll();
    const interval = setInterval(poll, 60000);
    return () => clearInterval(interval);
  }, [userId, userRole]);

  if (count === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500 rounded-full text-white text-[10px] font-bold animate-pulse">
      <Bell size={10} />
      {count}
    </div>
  );
}
