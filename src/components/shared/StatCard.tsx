/**
 * components/shared/StatCard.tsx — Tarjeta de estadística limpia
 * ==============================================================
 * Sin etiquetas redundantes, solo números brutos.
 * Diseño quirúrgico para lectura rápida sin fatiga visual.
 */

import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const variants = {
  default: 'bg-white border-gray-100 text-gray-900',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  danger: 'bg-red-50 border-red-200 text-red-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
} as const;

const iconColors = {
  default: 'text-gray-400',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  danger: 'text-red-500',
  info: 'text-blue-500',
  purple: 'text-purple-500',
} as const;

export default function StatCard({
  icon: Icon,
  value,
  label,
  variant = 'default',
  size = 'md',
  className = '',
}: StatCardProps) {
  const valueSize = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-2xl';

  return (
    <div
      className={`rounded-xl border p-4 transition-all hover:shadow-sm ${variants[variant]} ${className}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className={`${valueSize} font-bold leading-tight`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {label && (
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          )}
        </div>
        <div className={`${iconColors[variant]} opacity-70`}>
          <Icon size={size === 'sm' ? 18 : size === 'lg' ? 28 : 22} />
        </div>
      </div>
    </div>
  );
}
