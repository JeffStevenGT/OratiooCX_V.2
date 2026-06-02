/**
 * components/discador/CallButton.tsx — Botón de Llamada con Rate Limiting
 * =======================================================================
 * Protegido contra doble clic y avalanchas hacia VPBX.
 * Usa Zustand para rate limiting global (no solo por componente).
 */

'use client';

import { useState } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { useDialerStore } from '@/lib/dialer-store';

interface CallButtonProps {
  /** Teléfono del lead a llamar */
  clienteTelefono: string;
  /** Extensión SIP del asesor */
  asesorExt: string;
  /** DNI del lead (para registro) */
  dni?: string;
  /** Variante visual */
  variant?: 'primary' | 'outline' | 'ghost';
  /** Tamaño */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onCallStarted?: () => void;
  onCallFailed?: (error: string) => void;
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
} as const;

const variantClasses = {
  primary: 'bg-[#0a6ea9] hover:bg-[#085d8f] text-white border border-[#0a6ea9]',
  outline: 'border border-[#e0e0f0] hover:border-[#0a6ea9] text-[#0a6ea9] hover:bg-blue-50',
  ghost: 'text-[#0a6ea9] hover:bg-blue-50',
} as const;

export function CallButton({
  clienteTelefono,
  asesorExt,
  dni,
  variant = 'primary',
  size = 'md',
  className = '',
  onCallStarted,
  onCallFailed,
}: CallButtonProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const { isCalling, setCalling, canCall } = useDialerStore();

  const handleCall = async () => {
    if (!canCall()) return;
    setLocalError(null);

    setCalling(true, dni);

    try {
      const res = await fetch('/api/vpbx/originate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: asesorExt,
          to: clienteTelefono,
          dni,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error de conexión' }));
        throw new Error(err.error || `Error ${res.status}`);
      }

      onCallStarted?.();
    } catch (error: any) {
      setLocalError(error.message);
      setCalling(false);
      onCallFailed?.(error.message);
    }
  };

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <button
        onClick={handleCall}
        disabled={!canCall()}
        className={`
          flex items-center gap-2 rounded-lg font-medium transition-all
          disabled:opacity-40 disabled:cursor-not-allowed
          ${sizeClasses[size]}
          ${variantClasses[variant]}
          ${className}
        `}
        title={isCalling ? 'Llamada en curso...' : `Llamar a ${clienteTelefono}`}
      >
        <Phone size={size === 'sm' ? 14 : 16} className={isCalling ? 'animate-pulse' : ''} />
        {isCalling ? 'Llamando...' : 'Llamar'}
      </button>
      {localError && (
        <span className="text-[10px] text-red-500">{localError}</span>
      )}
    </div>
  );
}
