/**
 * app/(dashboard)/extracciones/page.tsx — Monitor de Extracciones del Bot
 */

'use client';

import { useState } from 'react';
import { BarChart3, Users, UserCheck, RefreshCw, TrendingUp, Loader2 } from 'lucide-react';
import CollapsibleSection from '@/components/shared/CollapsibleSection';
import { useAPI, apiUrl } from '@/hooks/useSWR';

const PERIODOS = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
  { key: 'trimestre', label: 'Trimestre' },
  { key: '6m', label: '6 Meses' },
  { key: 'all', label: 'Todo' },
];

type ExtraccionesData = {
  stats: {
    total: number; completados: number; cima: number;
    renoveMixto: number; cimaRenove: number; tasaExtraccion: number;
    noCliente: number; sinDatos: number; errores: number;
  };
  variantes: {
    maxDescuento: number; conDescuento: number; mejorPrecio: number;
    renoveMixto: number; multidispositivo: number; otros: number;
  };
  chart: { dia: string; label: string; completados: number; no_cliente: number; sin_datos: number; error: number; total: number }[];
  periodo: string; fechaCorte: string;
};

export default function ExtraccionesPage() {
  const [periodo, setPeriodo] = useState('hoy');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Fechas aplicadas (solo se actualizan al clickear Buscar)
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');

  const params = new URLSearchParams();
  if (appliedFrom || appliedTo) {
    if (appliedFrom) params.set('from', appliedFrom);
    if (appliedTo) params.set('to', appliedTo);
  } else {
    params.set('periodo', periodo);
  }

  const url = apiUrl('/api/dashboard/extracciones', Object.fromEntries(params));
  const { data, isLoading, mutate } = useAPI<ExtraccionesData>(url);

  const handleSearch = () => {
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
  };

  const clearDates = () => {
    setDateFrom('');
    setDateTo('');
    setAppliedFrom('');
    setAppliedTo('');
    setPeriodo('hoy');
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-[#481163]" /></div>;
  if (!data) return <div className="text-center py-20"><BarChart3 size={48} className="text-gray-400 mx-auto mb-4" /><p className="text-sm text-gray-500">Sin datos de extracciones</p></div>;

  const { stats, variantes, chart } = data;
  const maxChart = Math.max(1, ...chart.map(d => d.total));

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 size={22} className="text-[#0a6ea9]" /> Extracciones
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Resumen de datos procesados por el bot</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {PERIODOS.map(p => (
            <button
              key={p.key}
              onClick={() => { setPeriodo(p.key); setDateFrom(''); setDateTo(''); setAppliedFrom(''); setAppliedTo(''); }}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all font-medium ${
                periodo === p.key && !(appliedFrom || appliedTo)
                  ? 'bg-[#481163] text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
          <span className="text-gray-300 mx-1">|</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-800" />
          <span className="text-xs text-gray-400">a</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-gray-800" />
          {(dateFrom || dateTo) && (
            <button onClick={handleSearch}
              className="text-xs px-3 py-1.5 bg-[#0a6ea9] text-white rounded-lg font-medium hover:bg-[#085d8f]">
              Buscar
            </button>
          )}
          {(dateFrom || dateTo || appliedFrom || appliedTo) && (
            <button onClick={clearDates} className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">
              Limpiar
            </button>
          )}
          <button onClick={() => mutate()} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-600 p-2 rounded-lg">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard title="Total Procesados" value={stats.total.toLocaleString()} icon={Users} color="indigo" />
        <StatCard title="Clientes CIMA" value={stats.cima.toLocaleString()} subtitle={`${Math.round((stats.cima / Math.max(stats.total, 1)) * 100)}% del total`} icon={UserCheck} color="violet" />
        <StatCard title="Renove Mixto" value={stats.renoveMixto.toLocaleString()} subtitle="4 variantes valiosas" icon={RefreshCw} color="emerald" />
        <StatCard title="No Cliente" value={stats.noCliente.toLocaleString()} subtitle={`${Math.round((stats.noCliente / Math.max(stats.total, 1)) * 100)}% del total`} icon={Users} color="gray" />
        <StatCard title="Tasa CIMA+Renove" value={`${stats.tasaExtraccion}%`} subtitle={`${stats.cimaRenove} de ${stats.total} leads`} icon={TrendingUp} color="amber" />
      </div>

      {/* ── Variantes ── */}
      <div className="grid grid-cols-6 gap-2">
        <VariantCard label="Máx descuento" value={variantes.maxDescuento} bg="bg-emerald-50 dark:bg-emerald-900/20" border="border-emerald-200 dark:border-emerald-800" text="text-emerald-700" />
        <VariantCard label="Con descuento" value={variantes.conDescuento} bg="bg-blue-50 dark:bg-blue-900/20" border="border-blue-200 dark:border-blue-800" text="text-blue-700" />
        <VariantCard label="Mejor precio" value={variantes.mejorPrecio} bg="bg-amber-50 dark:bg-amber-900/20" border="border-amber-200 dark:border-amber-800" text="text-amber-700" />
        <VariantCard label="Renove mixto" value={variantes.renoveMixto} bg="bg-slate-50 dark:bg-slate-800" border="border-slate-200 dark:border-slate-700" text="text-slate-700" />
        <VariantCard label="Multidispositivo" value={variantes.multidispositivo} bg="bg-purple-50 dark:bg-purple-900/20" border="border-purple-200 dark:border-purple-800" text="text-purple-700" />
        <VariantCard label="Otros" value={variantes.otros} bg="bg-[#f0ecf0] dark:bg-gray-800" border="border-[#e8dce6] dark:border-gray-700" text="text-[#7c757c]" />
      </div>

      {/* ── Gráfico diario ── */}
      <CollapsibleSection
        title="Subidos vs Procesados por día"
        icon={<BarChart3 size={14} className="text-amber-500" />}
        defaultOpen
        badge="Últimos 7 días"
      >
        <div className="space-y-1.5 pt-2">
          {chart.map(d => {
            return (
              <div key={d.dia} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 dark:text-gray-400 w-16 text-right">{d.label}</span>
                <div className="flex-1 flex items-center gap-0.5 h-6">
                  <div className="h-full bg-[#0a6ea9] rounded-l" style={{ width: `${(d.completados / maxChart) * 100}%`, minWidth: d.completados > 0 ? '4px' : 0 }} title={`Completados: ${d.completados}`} />
                  <div className="h-full bg-green-500" style={{ width: `${(d.sin_datos / maxChart) * 100}%`, minWidth: d.sin_datos > 0 ? '4px' : 0 }} title={`Sin datos: ${d.sin_datos}`} />
                  <div className="h-full bg-red-400" style={{ width: `${(d.no_cliente / maxChart) * 100}%`, minWidth: d.no_cliente > 0 ? '4px' : 0 }} title={`No cliente: ${d.no_cliente}`} />
                  <div className="h-full bg-gray-400 rounded-r" style={{ width: `${(d.error / maxChart) * 100}%`, minWidth: d.error > 0 ? '4px' : 0 }} title={`Error: ${d.error}`} />
                </div>
                <span className="text-[10px] font-mono font-bold w-8 text-right">{d.total}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#0a6ea9]" /> Completados</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500" /> Sin datos</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400" /> No cliente</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-400" /> Error</span>
        </div>
      </CollapsibleSection>

      <div className="text-[10px] text-gray-400 dark:text-gray-500 text-right">
        Datos desde {data.fechaCorte} · {stats.completados} completados · {stats.sinDatos} sin datos · {stats.errores} errores
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color }: any) {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-600', violet: 'text-[#481163]', emerald: 'text-emerald-600',
    gray: 'text-gray-500', amber: 'text-amber-600',
  };
  return (
    <div className="card text-center py-4">
      <Icon size={22} className={`mx-auto mb-1.5 ${colors[color] || 'text-gray-500'}`} />
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">{title}</p>
      {subtitle && <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function VariantCard({ label, value, bg, border, text }: { label: string; value: number; bg: string; border: string; text: string }) {
  return (
    <div className={`${bg} ${border} border rounded-lg px-3 py-2.5 text-center`}>
      <p className={`text-[10px] font-medium ${text}`}>{label}</p>
      <p className={`text-lg font-bold ${text}`}>{value}</p>
    </div>
  );
}
