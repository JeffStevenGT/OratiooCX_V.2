/**
 * lib/dialer-store.ts — Estado Global del Power Dialer con Zustand
 * ==================================================================
 * Centraliza el estado de llamadas para evitar dependencias del ciclo
 * de vida de React y permitir rate limiting a nivel global.
 */

import { create } from 'zustand';

interface DialerState {
  /** Si hay una llamada en curso en CUALQUIER parte del sistema */
  isCalling: boolean;
  /** Timestamp de la última llamada (para rate limiting) */
  lastCallAt: number | null;
  /** DNI del lead que se está llamando actualmente */
  currentDni: string | null;

  setCalling: (status: boolean, dni?: string) => void;
  canCall: () => boolean;
}

export const useDialerStore = create<DialerState>((set, get) => ({
  isCalling: false,
  lastCallAt: null,
  currentDni: null,

  setCalling: (status: boolean, dni?: string) => {
    set({
      isCalling: status,
      currentDni: dni ?? null,
      lastCallAt: status ? Date.now() : get().lastCallAt,
    });

    // Auto-desbloquear después de 5 segundos de cooldown
    if (status) {
      setTimeout(() => {
        set({ isCalling: false, currentDni: null });
      }, 5000);
    }
  },

  canCall: () => {
    const { isCalling, lastCallAt } = get();
    if (isCalling) return false;

    // Rate limiting: mínimo 5 segundos entre llamadas
    if (lastCallAt && Date.now() - lastCallAt < 5000) {
      return false;
    }

    return true;
  },
}));
