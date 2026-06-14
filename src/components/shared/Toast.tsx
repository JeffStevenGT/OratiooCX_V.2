/**
 * components/shared/Toast.tsx — Toast Notifications System
 * ==========================================================
 * Toasts síncronos que se apilan, con auto-dismiss y tipos.
 *
 * Uso:
 *   import { toast } from '@/components/shared/Toast';
 *   toast.success('Lead asignado correctamente');
 *   toast.error('Error al guardar');
 *   toast.info('Procesando...');
 */

'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

type Toast = {
  id: number;
  message: string;
  type: ToastType;
  exiting?: boolean;
};

let toastId = 0;
const listeners: Set<(toasts: Toast[]) => void> = new Set();
let toasts: Toast[] = [];

function notify() {
  listeners.forEach(fn => fn([...toasts]));
}

export const toast = {
  success(msg: string) { add(msg, 'success'); },
  error(msg: string) { add(msg, 'error'); },
  info(msg: string) { add(msg, 'info'); },
  warning(msg: string) { add(msg, 'warning'); },
};

function add(message: string, type: ToastType) {
  const id = ++toastId;
  toasts = [...toasts, { id, message, type }];
  notify();
  setTimeout(() => remove(id), 3500);
}

function remove(id: number) {
  // Marcar como exiting para animación
  toasts = toasts.map(t => t.id === id ? { ...t, exiting: true } : t);
  notify();
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    notify();
  }, 300);
}

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors: Record<ToastType, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
  info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
};

export default function ToastContainer() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    listeners.add(setItems);
    return () => { listeners.delete(setItems); };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {items.map(t => {
        const Icon = icons[t.type];
        return (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-2.5 px-4 py-3 rounded-lg border shadow-lg text-sm transition-all duration-300',
              colors[t.type],
              t.exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 animate-fade-in'
            )}
          >
            <Icon size={16} className="shrink-0" />
            <span className="flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} className="shrink-0 opacity-50 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
