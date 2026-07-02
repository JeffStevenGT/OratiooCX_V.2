/**
 * components/shared/TimeTabs.tsx — Hoy / Semana / Mes / Personalizado
 */
'use client';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

const OPTIONS = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: '7 días' },
  { key: 'mes', label: '30 días' },
];

export default function TimeTabs({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
      {OPTIONS.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
            value === o.key
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Converts time preset to desde/hasta dates */
export function timePresetToRange(preset: string): { desde: string; hasta: string } {
  const hoy = new Date();
  const hasta = hoy.toISOString().split('T')[0];
  let desde: string;
  switch (preset) {
    case 'hoy':
      desde = hasta;
      break;
    case 'semana':
      desde = new Date(hoy.getTime() - 7 * 86400000).toISOString().split('T')[0];
      break;
    case 'mes':
    default:
      desde = new Date(hoy.getTime() - 30 * 86400000).toISOString().split('T')[0];
      break;
  }
  return { desde, hasta };
}
