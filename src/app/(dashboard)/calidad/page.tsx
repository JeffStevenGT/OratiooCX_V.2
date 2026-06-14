/**
 * app/(dashboard)/calidad/page.tsx — Quality Assurance Dashboard
 */

'use client';

import { useState, useEffect } from 'react';
import { Star, TrendingUp, Users, Loader2, CheckCircle2, BarChart3, Eye, MessageCircle, Award } from 'lucide-react';
import Skeleton, { TableSkeleton } from '@/components/shared/Skeleton';
import { toast } from '@/components/shared/Toast';
import FlipCard from '@/components/shared/FlipCard';
import Paginator from '@/components/shared/Paginator';

type Resumen = { nombre: string; equipo: string; total_evaluaciones: number; promedio: number; avg_speech: number; avg_cierre: number; avg_empatia: number; ultima_evaluacion: string };
type Evaluacion = { id: number; asesor_nombre: string; auditor_nombre: string; dni: string; puntaje_total: number; puntaje_speech: number; puntaje_objeciones: number; puntaje_cierre: number; puntaje_compliance: number; puntaje_empatia: number; notas: string; created_at: string };

const CRITERIOS = ['Speech', 'Objeciones', 'Cierre', 'Compliance', 'Empatía'];

export default function CalidadPage() {
  const [resumen, setResumen] = useState<Resumen[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'resumen' | 'evaluaciones'>('resumen');
  const [resumenPage, setResumenPage] = useState(1);
  const [evalPage, setEvalPage] = useState(1);
  const [resumenPS, setResumenPS] = useState(10);
  const [evalPS, setEvalPS] = useState(10);

  useEffect(() => {
    Promise.all([
      fetch('/api/qa', { method: 'PATCH' }).then(r => r.json()),
      fetch('/api/qa').then(r => r.json()),
    ]).then(([r, e]) => {
      setResumen(Array.isArray(r) ? r : []);
      setEvaluaciones(Array.isArray(e) ? e : []);
    }).catch(() => { toast.error('Error al cargar datos de calidad'); }).finally(() => setLoading(false));
  }, []);

  const promedioGeneral = resumen.length > 0
    ? Math.round(resumen.reduce((s, a) => s + (a.promedio || 0), 0) / resumen.filter(a => a.total_evaluaciones > 0).length)
    : 0;

  const resumenTotal = Math.ceil(resumen.length / resumenPS);
  const evalTotal = Math.ceil(evaluaciones.length / evalPS);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Quality Assurance</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Calidad de llamadas</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <FlipCard back="Promedio de puntuación sobre 25 puntos">
          <KPI icon={Award} label="Promedio general" value={`${promedioGeneral}/25`} color="text-amber-500" loading={loading} />
        </FlipCard>
        <FlipCard back="Cantidad de asesores con evaluaciones">
          <KPI icon={Users} label="Asesores evaluados" value={resumen.filter(a => a.total_evaluaciones > 0).length} color="text-blue-600" loading={loading} />
        </FlipCard>
        <FlipCard back="Total de evaluaciones realizadas">
          <KPI icon={BarChart3} label="Total evaluaciones" value={evaluaciones.length} color="text-purple-600" loading={loading} />
        </FlipCard>
        <FlipCard back="Mejor puntuación individual">
          <KPI icon={Star} label="Top score" value={resumen[0]?.promedio ? `${resumen[0].promedio}/25` : '—'} color="text-emerald-600" loading={loading} />
        </FlipCard>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button onClick={() => setTab('resumen')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'resumen' ? 'border-[#0a6ea9] text-[#0a6ea9]' : 'border-transparent text-gray-500 dark:text-gray-400'}`}>Resumen por asesor</button>
        <button onClick={() => setTab('evaluaciones')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'evaluaciones' ? 'border-[#0a6ea9] text-[#0a6ea9]' : 'border-transparent text-gray-500 dark:text-gray-400'}`}>Evaluaciones recientes</button>
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={8} />
      ) : tab === 'resumen' ? (
        <div className="card !p-0 overflow-hidden">
          {resumen.length === 0 ? (
            <div className="text-center py-12"><Star size={40} className="text-gray-400 dark:text-gray-500 mx-auto mb-2" /><p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Sin evaluaciones aún</p><p className="text-xs text-gray-400 dark:text-gray-500">Las evaluaciones de calidad aparecerán aquí cuando se realicen</p></div>
          ) : (<>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <th className="table-header px-4 py-2 text-left">Asesor</th>
                  <th className="table-header px-4 py-2 text-left">Equipo</th>
                  <th className="table-header px-4 py-2 text-center">Eval.</th>
                  <th className="table-header px-4 py-2 text-center">Promedio</th>
                  <th className="table-header px-4 py-2 text-center">Speech</th>
                  <th className="table-header px-4 py-2 text-center">Cierre</th>
                  <th className="table-header px-4 py-2 text-center">Empatía</th>
                  <th className="table-header px-4 py-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {resumen.slice((resumenPage - 1) * resumenPS, resumenPage * resumenPS).map(a => (
                  <tr key={a.nombre} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-800 text-xs">
                    <td className="py-2.5 px-4 font-medium">{a.nombre}</td>
                    <td className="py-2.5 px-4 text-gray-500 dark:text-gray-400">{a.equipo}</td>
                    <td className="py-2.5 px-4 text-center">{a.total_evaluaciones}</td>
                    <td className="py-2.5 px-4 text-center font-bold">
                      <span className={a.promedio >= 20 ? 'text-emerald-600' : a.promedio >= 15 ? 'text-amber-600' : 'text-red-500'}>{a.promedio}</span>
                      <span className="text-gray-400 dark:text-gray-500">/25</span>
                    </td>
                    <td className="py-2.5 px-4 text-center">{a.avg_speech || '—'}</td>
                    <td className="py-2.5 px-4 text-center">{a.avg_cierre || '—'}</td>
                    <td className="py-2.5 px-4 text-center">{a.avg_empatia || '—'}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${a.promedio >= 20 ? 'bg-emerald-500' : a.promedio >= 15 ? 'bg-amber-500' : 'bg-red-400'}`}
                            style={{ width: `${(a.promedio / 25) * 100}%` }} />
                        </div>
                        <span className="text-[9px] w-8 text-right">{a.promedio}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Paginator page={resumenPage} total={resumen.length} pageSize={resumenPS} setPage={setResumenPage} setPageSize={setResumenPS} />
          </>)}
        </div>
      ) : (
        <div className="space-y-3">
          {evaluaciones.length === 0 ? (
            <div className="card text-center py-12"><MessageCircle size={40} className="text-gray-400 dark:text-gray-500 mx-auto mb-2" /><p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Sin evaluaciones aún</p><p className="text-xs text-gray-400 dark:text-gray-500">Las evaluaciones de calidad aparecerán aquí cuando se realicen</p></div>
          ) : (
            evaluaciones.slice((evalPage - 1) * evalPS, evalPage * evalPS).map(e => (
              <div key={e.id} className="card border-l-4 border-[#0a6ea9]">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs font-semibold">{e.asesor_nombre} · {e.dni}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Evaluado por {e.auditor_nombre} · {new Date(e.created_at).toLocaleDateString('es-PE')}</p>
                  </div>
                  <span className={`text-sm font-bold rounded-full px-3 py-1 ${e.puntaje_total >= 20 ? 'bg-emerald-100 text-emerald-700' : e.puntaje_total >= 15 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {e.puntaje_total}/25
                  </span>
                </div>
                <div className="flex gap-2 mb-2">
                  {[{l:'S',v:e.puntaje_speech},{l:'O',v:e.puntaje_objeciones},{l:'C',v:e.puntaje_cierre},{l:'Cp',v:e.puntaje_compliance},{l:'E',v:e.puntaje_empatia}].map((c,i) => (
                    <span key={i} className={`text-[9px] rounded-full px-2 py-0.5 font-medium ${c.v >= 4 ? 'bg-emerald-100 text-emerald-700' : c.v >= 3 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                      {c.l}: {c.v}★
                    </span>
                  ))}
                </div>
                {e.notas && <p className="text-[10px] text-gray-500 dark:text-gray-400 italic">"{e.notas}"</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function KPI({ icon: Icon, label, value, color, loading }: any) {
  return (
    <div className="card text-center">
      <Icon size={22} className={`mx-auto mb-1.5 ${color}`} />
      {loading ? <div className="w-10 h-6 bg-gray-200 rounded animate-pulse mx-auto" /> : <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>}
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
