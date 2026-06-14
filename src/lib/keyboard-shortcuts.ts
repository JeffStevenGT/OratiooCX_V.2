/**
 * lib/keyboard-shortcuts.ts — Global Keyboard Shortcuts
 * =======================================================
 * Atajos de teclado para usuarios avanzados.
 *
 * Uso en layout:
 *   <KeyboardShortcuts />
 */

'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // No activar si estamos en un input/textarea/select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // No activar con modales abiertos
      if (document.querySelector('[role="dialog"]')) return;

      // Escape → cerrar modales lo maneja el navegador

      // Alt + tecla → navegación rápida
      if (e.altKey) {
        const map: Record<string, string> = {
          'c': '/clientes',
          'p': '/pipeline',
          'a': '/agenda',
          'b': '/bots',
          'e': '/estadisticas',
          'u': '/usuarios',
          's': '/supervisor',
          'j': '/jefe',
          'i': '/inicio',
          'd': '/power-dialer',
          'g': '/config',
        };
        const target = map[e.key.toLowerCase()];
        if (target) {
          e.preventDefault();
          router.push(target);
        }
      }

      // / → focus search (en páginas con search)
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Buscar"], input[placeholder*="buscar"]');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router, pathname]);

  return null; // Componente invisible
}
