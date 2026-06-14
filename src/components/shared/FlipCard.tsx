/**
 * components/shared/FlipCard.tsx — Card que gira al hacer click
 * ==============================================================
 * Frente: contenido normal (StatCard, KPI, etc.)
 * Reverso: explicación de qué mide y por qué importa
 *
 * Uso:
 *   <FlipCard back="Porcentaje de leads contactados del total asignados">
 *     <StatCard ... />
 *   </FlipCard>
 */

'use client';

import { useState, ReactNode } from 'react';

type Props = {
  children: ReactNode;
  back: string;
  className?: string;
};

export default function FlipCard({ children, back, className = '' }: Props) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className={`relative cursor-pointer ${className}`}
      style={{ perspective: '1000px' }}
      onClick={() => setFlipped(!flipped)}
    >
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Frente */}
        <div style={{ backfaceVisibility: 'hidden' }}>
          {children}
        </div>

        {/* Reverso */}
        <div
          className="absolute inset-0 rounded-xl border border-[#e0e0f0] dark:border-[#2a2a3a] bg-[#f8f7fa] dark:bg-[#1e1a2a] p-4 flex items-center justify-center text-center"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <p className="text-xs text-[#7c757c] dark:text-[#9a9aaa] leading-relaxed">{back}</p>
        </div>
      </div>
    </div>
  );
}

/** Diccionario de descripciones para métricas comunes */
export const METRIC_DESCRIPTIONS: Record<string, string> = {
  'Total Leads': 'Cantidad total de leads procesados por el bot desde Pangea Orange. Incluye clientes activos y no clientes.',
  'Clientes CIMA': 'Clientes con plan Imagina Móvil Avanzado. Mayor comisión y prioridad de venta.',
  'Renove Mixto': 'Clientes que pueden renovar tarifa móvil + fibra. Las 4 variantes con mayor potencial de venta.',
  'No Cliente': 'DNIs consultados que no pertenecen a Orange. No son leads válidos para venta.',
  'Tasa CIMA+Renove': 'Porcentaje de leads que son CIMA y tienen Renove Mixto simultáneamente. Máxima prioridad comercial.',
  'Contactabilidad': 'Porcentaje de leads contactados vs asignados. Mide la capacidad del asesor de establecer contacto.',
  'Efectividad': 'Porcentaje de ventas sobre leads contactados. Mide la capacidad de cierre del asesor.',
  'Tasa Contestación': 'Porcentaje de llamadas contestadas vs realizadas. Indica la calidad de los números y horarios de llamada.',
  'Ocupación': 'Porcentaje de tiempo en llamada vs tiempo conectado. Mide la eficiencia del asesor en el teléfono.',
  'Calidad': 'Puntuación promedio de evaluaciones QA. Escala 0-25 basada en speech, objeciones, cierre y compliance.',
  'Evaluados': 'Total de leads evaluados por el scoring. Solo se evalúan leads con datos completos de CIMA, Renove y consumo.',
  'Top Leads': 'Leads con puntuación A+ o A. Máxima prioridad para asignar a los mejores asesores.',
  'Calientes': 'Leads con puntuación A+ a B. Buen potencial de conversión.',
  'Fríos': 'Leads con puntuación D o E. Bajo potencial, asignar al final.',
  'Punt. Media': 'Puntuación promedio de todos los leads evaluados. Escala 1-100.',
  'Media Diaria': 'Promedio de ventas por día en el período seleccionado.',
  'Forecast Total': 'Proyección de ventas para el período de forecast basado en el modelo predictivo.',
  'Pendientes': 'Leads asignados que aún no han sido contactados. Requieren acción del asesor.',
  'Contactados': 'Leads donde se logró establecer contacto con el cliente.',
  'Ventas': 'Total de ventas cerradas en el período.',
  'Asesores Activos': 'Cantidad de asesores que realizaron al menos una llamada en el período.',
  'Total Abandonados': 'Leads que salieron del pipeline como No Interesa o No Contesta.',
  'Tasa Reutilización': 'Porcentaje de leads que fueron reanalizados por el bot para detectar cambios.',
  'Wrap Up': 'Tiempo promedio que el asesor tarda en codificar después de colgar (segundos).',
  'Hasta Llamar': 'Tiempo promedio entre llamadas (segundos). Mide la velocidad del asesor.',
};
