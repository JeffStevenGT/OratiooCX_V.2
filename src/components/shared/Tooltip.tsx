/**
 * components/shared/Tooltip.tsx — Tooltip estilizado
 * ===================================================
 * Tooltip con Tailwind que aparece en hover sobre cualquier elemento.
 *
 * Uso:
 *   <Tooltip text="Cliente Imagina Móvil Avanzado — plan premium de Orange">
 *     <span className="badge">CIMA</span>
 *   </Tooltip>
 *
 *   <Tooltip text="Renove Mixto" position="top">
 *     <span className="text-xs text-blue-600">RM</span>
 *   </Tooltip>
 */

'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  text: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
};

const TOOLTIPS: Record<string, string> = {
  CIMA: 'Cliente Imagina Móvil Avanzado — plan premium de Orange con mayores comisiones',
  'Renove Mixto': 'Cliente que puede renovar su tarifa móvil + fibra. Alta prioridad de venta.',
  VAP: 'Venta a Plazos — dispositivos financiados (móviles, tablets). Indica capacidad de compra.',
  Permanencia: 'Tiempo restante de compromiso con Orange. Si venció = cliente libre para portabilidad.',
  Hotline: 'Línea suspendida por impago. El cliente no puede hacer llamadas salientes.',
  TV: 'Cliente con servicio de televisión Orange TV contratado.',
  Scoring: 'Puntuación predictiva del 1-100 basada en CIMA, Renove, permanencia y consumo.',
  Pipeline: 'Flujo comercial: pendiente → contactado → interesado → negociación → venta.',
};

export function getTooltipText(term: string): string {
  return TOOLTIPS[term] || '';
}

export default function Tooltip({ text, children, position = 'top', delay = 400, className }: Props) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  };
  const hide = () => {
    clearTimeout(timerRef.current);
    setVisible(false);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const positions: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className={cn('relative inline-flex', className)} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <div
          className={cn(
            'absolute z-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-white bg-[#1a1030] rounded-lg shadow-lg pointer-events-none whitespace-nowrap max-w-[280px] whitespace-normal',
            positions[position],
            'animate-fade-in'
          )}
        >
          {text}
          <div className={cn(
            'absolute w-2 h-2 bg-[#1a1030] rotate-45',
            position === 'top' ? 'top-full -mt-1 left-1/2 -translate-x-1/2' :
            position === 'bottom' ? 'bottom-full -mb-1 left-1/2 -translate-x-1/2' :
            position === 'left' ? 'left-full -ml-1 top-1/2 -translate-y-1/2' :
            'right-full -mr-1 top-1/2 -translate-y-1/2'
          )} />
        </div>
      )}
    </div>
  );
}
