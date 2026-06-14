/**
 * components/shared/Paginator.tsx — Paginación unificada
 * ======================================================
 * Mismo estilo que estadísticas:
 *   Mostrar [10|25|50|100 ▼] de N   |   Anterior  1/5  Siguiente
 */

'use client';

const PAGE_SIZES = [10, 25, 50, 100];

type Props = {
  page: number;
  total: number;
  pageSize: number;
  setPage: (p: number | ((prev: number) => number)) => void;
  setPageSize: (s: number) => void;
};

export default function Paginator({ page, total, pageSize, setPage, setPageSize }: Props) {
  if (total <= PAGE_SIZES[0]) return null;

  const totalPages = Math.ceil(total / pageSize);
  const showing = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-[#e8dce6]">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#7c757c]">Mostrar</span>
        <select value={pageSize} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setPageSize(+e.target.value); setPage(1); }}
          className="border border-[#e0e0f0] rounded-lg px-2 py-1 text-xs bg-white">
          {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-[#7c757c]">de {total}</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage((p: number) => Math.max(1, p - 1))} disabled={page === 1}
          className="btn-outline text-xs px-3 py-1 disabled:opacity-30">Anterior</button>
        <span className="text-xs text-[#7c757c] px-2">{page} / {totalPages}</span>
        <button onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
          className="btn-outline text-xs px-3 py-1 disabled:opacity-30">Siguiente</button>
      </div>
    </div>
  );
}
