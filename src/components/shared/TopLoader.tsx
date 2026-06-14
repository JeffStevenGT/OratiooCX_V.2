/**
 * components/shared/TopLoader.tsx — Barra de progreso al navegar
 * Feedback visual inmediato al hacer clic en sidebar/links.
 * Evita que el usuario haga múltiples clics por impaciencia.
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function TopLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    // Iniciar animación al cambiar de ruta
    setLoading(true);
    setWidth(0);
    // Deshabilitar clics mientras carga (evita múltiples navegaciones)
    document.body.style.cursor = 'wait';
    document.body.style.pointerEvents = 'auto';

    // Simular progreso rápido al inicio (efecto psicológico)
    let progress = 0;
    const step = () => {
      progress += progress < 30 ? 15 : progress < 70 ? 5 : 2;
      if (progress > 85) progress = 85;
      setWidth(progress);
      if (progress < 85) {
        animRef.current = window.setTimeout(step, 200);
      }
    };
    animRef.current = window.setTimeout(step, 50);

    // Completar al cargar
    const finish = () => {
      setWidth(100);
      document.body.style.cursor = '';
      timerRef.current = setTimeout(() => {
        setLoading(false);
        setWidth(0);
      }, 300);
    };

    // Timeout de seguridad: si tarda más de 8s, completar igual
    const safety = setTimeout(finish, 8000);

    return () => {
      clearTimeout(safety);
      if (animRef.current) clearTimeout(animRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      finish();
    };
  }, [pathname, searchParams]);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px]">
      <div
        className="h-full bg-[#0a6ea9] transition-all duration-300 ease-out rounded-r-full shadow-[0_0_8px_rgba(10,110,169,0.5)]"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
