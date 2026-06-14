/**
 * components/shared/Skeleton.tsx — Skeleton Loaders
 * ==================================================
 * Reemplaza los spinners genéricos con placeholders que imitan
 * la forma del contenido final.
 *
 * Uso:
 *   <Skeleton variant="table" rows={10} cols={6} />
 *   <Skeleton variant="card" count={3} />
 *   <Skeleton variant="text" lines={4} />
 *   <Skeleton variant="kpi" count={5} />
 */

'use client';

import { cn } from '@/lib/utils';

type SkeletonProps = {
  variant: 'table' | 'card' | 'text' | 'kpi' | 'detail';
  rows?: number;
  cols?: number;
  count?: number;
  lines?: number;
  className?: string;
};

function Bone({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded bg-[#e8dce6]', className)} />
  );
}

export default function Skeleton({ variant, rows = 5, cols = 4, count = 3, lines = 3, className = '' }: SkeletonProps) {
  if (variant === 'table') {
    return (
      <div className={cn('space-y-2 p-4', className)}>
        {/* Header */}
        <div className="flex gap-3 pb-2">
          {Array.from({ length: cols }).map((_, i) => (
            <Bone key={i} className="h-4 flex-1" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-3 py-2">
            {Array.from({ length: cols }).map((_, c) => (
              <Bone key={c} className={`h-3 flex-1 ${c === 0 ? 'w-24' : ''}`} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="card-sm space-y-3">
            <Bone className="h-4 w-1/3" />
            <Bone className="h-8 w-2/3" />
            <Bone className="h-3 w-full" />
            <Bone className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <Bone key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    );
  }

  if (variant === 'kpi') {
    return (
      <div className={cn('grid grid-cols-2 md:grid-cols-5 gap-3', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="card-sm space-y-2 py-3">
            <Bone className="h-3 w-16 mx-auto" />
            <Bone className="h-7 w-12 mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className={cn('space-y-4', className)}>
        <Bone className="h-6 w-48" />
        <Bone className="h-4 w-32" />
        <div className="grid grid-cols-2 gap-4 mt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Bone className="h-3 w-20" />
              <Bone className="h-4 w-36" />
            </div>
          ))}
        </div>
        <Bone className="h-32 w-full mt-4" />
      </div>
    );
  }

  return null;
}

/** Skeleton específico para filas de tabla */
export function TableSkeleton({ rows = 10, cols = 6 }: { rows?: number; cols?: number }) {
  return <Skeleton variant="table" rows={rows} cols={cols} />;
}

/** Skeleton para página completa (título + filtros + tabla) */
export function PageSkeleton({ rows = 10, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Bone className="h-6 w-40" />
          <Bone className="h-3 w-24" />
        </div>
        <div className="flex gap-2">
          <Bone className="h-8 w-24 rounded-lg" />
          <Bone className="h-8 w-24 rounded-lg" />
        </div>
      </div>
      <div className="card-sm flex gap-3">
        <Bone className="h-9 flex-1 rounded-lg" />
        <Bone className="h-9 w-32 rounded-lg" />
        <Bone className="h-9 w-32 rounded-lg" />
        <Bone className="h-9 w-28 rounded-lg" />
      </div>
      <Skeleton variant="table" rows={rows} cols={cols} />
    </div>
  );
}
