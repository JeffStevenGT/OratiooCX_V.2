/**
 * lib/pipeline-colors.ts — Paleta semántica consistente
 * ======================================================
 * Colores para estados de pipeline, niveles de scoring, etc.
 *
 * Principio:
 *   Verde  = avance / éxito
 *   Ámbar  = estancado / advertencia
 *   Rojo   = pérdida / error
 *   Gris   = neutro / pendiente
 *   Azul   = informativo
 *   Púrpura = premium / CIMA
 */

export const PIPELINE_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  pendiente:     { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-200 dark:border-gray-700', label: 'Pendiente' },
  contactado:    { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800', label: 'Contactado' },
  interesado:    { bg: 'bg-sky-100 dark:bg-sky-900', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-200 dark:border-sky-800', label: 'Interesado' },
  negociacion:   { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', label: 'Negociación' },
  venta:         { bg: 'bg-emerald-100 dark:bg-emerald-900', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', label: 'Venta' },
  tramitado:     { bg: 'bg-teal-100 dark:bg-teal-900', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800', label: 'Tramitado' },
  activado:      { bg: 'bg-emerald-100 dark:bg-emerald-900', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', label: 'Activado' },
  no_interesa:   { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800', label: 'No interesa' },
  no_contesta:   { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800', label: 'No contesta' },
};

export const SCORING_COLORS: Record<string, string> = {
  'A+': '#ef4444', // Rojo intenso — máxima prioridad
  'A':  '#f97316', // Naranja — alta prioridad
  'B':  '#eab308', // Amarillo — media-alta
  'C':  '#22c55e', // Verde — media
  'D':  '#94a3b8', // Gris — baja
  'E':  '#6b7280', // Gris oscuro — mínima
};

export const CIMA_COLORS = {
  si: { bg: 'bg-emerald-100 dark:bg-emerald-900', text: 'text-emerald-700 dark:text-emerald-300' },
  no: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400' },
};

export const RENOVE_COLORS = {
  si: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-700 dark:text-blue-300' },
  no: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400' },
};

/** Badge reutilizable para estados de pipeline */
export function pipelineBadge(estado: string) {
  const c = PIPELINE_COLORS[estado] || PIPELINE_COLORS.pendiente;
  return `${c.bg} ${c.text} ${c.border}`;
}
