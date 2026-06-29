/**
 * app/(dashboard)/asignar-leads/page.tsx — Asignar Leads v3 (chips por jerarquía)
 * CEO → Jefes | Jefe → Supervisores | Supervisor → Asesores
 */

'use client';

import { useState, useEffect } from 'react';
import { Users, Loader2, CheckCircle2, UserPlus, Send, RotateCcw } from 'lucide-react';
import { toast } from '@/components/shared/Toast';

type Lead = { id_cliente: string; dni: string; nombre: string; cima: string; tiene_renove: boolean; renove_valioso: boolean; mejor_variante: string | null; prioridad: number };
type Liberado = { id_cliente: string; dni: string; nombre: string; asesor_anterior: string; liberado_at: string };
type Subordinado = { id: number; nombre: string; equipo: string; rol: string; pendientes: number };

const VARIANTES = [
  { key: 'maximo', label: 'Máx descuento', text: 'Renove mixto al mejor precio con máximo descuento', color: 'emerald' },
  { key: 'con_descuento', label: 'Con descuento', text: 'Renove mixto al mejor precio con descuento', color: 'blue' },
  { key: 'mejor_precio', label: 'Mejor precio', text: 'Renove mixto al mejor precio', color: 'amber' },
  { key: 'renove_mixto', label: 'Renove mixto', text: 'Renove mixto', color: 'slate' },
];
const VARIANTES_MENORES = [
  { key: 'multidispositivo', label: 'Multidispositivo' },
  { key: 'otros', label: 'Otros' },
];

export default function AsignarLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [liberados, setLiberados] = useState<Liberado[]>([]);
  const [tab, setTab] = useState<'pendientes' | 'liberados'>('pendientes');
  const [subordinados, setSubordinados] = useState<Subordinado[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [varianteFilter, setVarianteFilter] = useState('');
  const [cimaFilter, setCimaFilter] = useState<string | null>(null);
  const [renoveFilter, setRenoveFilter] = useState<string | null>(null);
  const [variantesActivas, setVariantesActivas] = useState<string[]>([]);
  const [asignando, setAsignando] = useState(false);
  const [resultado, setResultado] = useState('');

  // Cantidad de leads a asignar por subordinado
  const [cantidades, setCantidades] = useState<Record<string, string>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      // Sesión para saber rol y equipo
      const sRes = await fetch('/api/auth/session');
      const s = await sRes.json();
      const role = s?.user?.role || 'asesor';
      const userId = s?.user?.id;
      const userEquipo = s?.user?.team || '';
      setUserRole(role);

      // Cargar leads + liberados + subordinados
      const [lRes, libRes, uRes] = await Promise.all([
        fetch('/api/pipeline'),
        fetch('/api/pipeline/liberados'),
        fetch('/api/usuarios'),
      ]);
      const allUsers = await uRes.json();
      const leadsData = await lRes.json();
      setLeads(leadsData.leads || (Array.isArray(leadsData) ? leadsData : []));
      setLiberados(await libRes.json());

      // Determinar subordinados según jerarquía
      let subs: any[] = [];
      if (['desarrollador', 'it'].includes(role)) {
        // CEO ve jefes de área
        subs = allUsers.filter((u: any) => u.rol === 'jefe_area' && u.activo);
      } else if (role === 'jefe_area') {
        // Jefe ve supervisores de su equipo, o asesores directamente si no hay supervisores
        subs = allUsers.filter((u: any) => u.rol === 'supervisor' && u.activo && (!userEquipo || u.equipo === userEquipo));
        if (subs.length === 0) {
          subs = allUsers.filter((u: any) => u.rol === 'asesor' && u.activo && u.supervisor_id === parseInt(userId));
        }
      } else if (role === 'supervisor') {
        // Supervisor ve asesores que le reportan
        subs = allUsers.filter((u: any) => u.rol === 'asesor' && u.activo && u.supervisor_id === parseInt(userId));
      }

      // Obtener pendientes de cada subordinado
      const subsWithCounts = await Promise.all(subs.map(async (sub: any) => {
        const nRes = await fetch(`/api/pipeline/notifications?user_id=${sub.id}&rol=${sub.rol}`);
        const n = await nRes.json();
        return { ...sub, pendientes: n.totalPendientes || 0 };
      }));

      setSubordinados(subsWithCounts);

      // Inicializar cantidades vacías
      const init: Record<string, string> = {};
      for (const s of subsWithCounts) init[String(s.id)] = '';
      setCantidades(init);
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const totalAsignado = Object.values(cantidades).reduce((s, v) => s + (parseInt(v) || 0), 0);
  const filtered = (() => {
    let result = leads;
    if (cimaFilter) result = result.filter(l => l.cima === cimaFilter);
    if (renoveFilter === 'SI') result = result.filter(l => l.tiene_renove && l.renove_valioso);
    else if (renoveFilter === 'NO') result = result.filter(l => !l.tiene_renove || !l.renove_valioso);
    if (variantesActivas.length > 0) {
      result = result.filter(l => {
        return variantesActivas.some(vk => {
          // Variantes principales
          const v = VARIANTES.find(x => x.key === vk);
          if (v) return l.mejor_variante?.toLowerCase().includes(v.text.toLowerCase());
          // Multidispositivo
          if (vk === 'multidispositivo') return l.mejor_variante === 'Renove Multidispositivo';
          // Otros
          if (vk === 'otros') {
            if (!l.mejor_variante || l.mejor_variante === 'N/A') return false;
            const allKnown = [...VARIANTES.map(x => x.text), 'Renove Multidispositivo'];
            return !allKnown.some(k => l.mejor_variante?.toLowerCase().includes(k.toLowerCase()));
          }
          return false;
        });
      });
    }
    if (varianteFilter) {
      result = result.filter(l => l.mejor_variante?.toLowerCase().includes(
        varianteFilter === 'Max Descuento' ? 'maximo descuento' :
        varianteFilter === 'Con Descuento' ? 'con descuento' :
        varianteFilter === 'Al Mejor Precio' ? 'al mejor precio' : 'mixto'
      ));
    }
    return result;
  })();
  const disponibles = filtered.length;
  const excede = totalAsignado > disponibles;

  const setCantidad = (userId: string, val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    setCantidades(prev => ({ ...prev, [userId]: clean }));
  };

  const repartirIgual = () => {
    if (subordinados.length === 0) return;
    const porUno = Math.floor(filtered.length / subordinados.length);
    const init: Record<string, string> = {};
    for (const s of subordinados) init[String(s.id)] = String(porUno);
    setCantidades(init);
  };

  const asignar = async () => {
    if (subordinados.length === 0) { toast.error('No hay usuarios para asignar'); return; }
    if (totalAsignado === 0) { toast.error('Asigna al menos 1 lead'); return; }
    if (excede) { toast.error('No podés asignar más leads de los disponibles'); return; }

    setAsignando(true);
    try {
      let leadsRestantes = [...filtered.map(l => l.id_cliente)];
      let asignados = 0;

      for (const sub of subordinados) {
        const count = parseInt(cantidades[String(sub.id)] || '0');
        if (count <= 0 || leadsRestantes.length === 0) continue;
        const tomar = leadsRestantes.splice(0, Math.min(count, leadsRestantes.length));
        await fetch('/api/pipeline', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leads: tomar, asesor_id: sub.id }),
        });
        asignados += tomar.length;
      }

      setResultado(`${asignados} leads repartidos entre ${subordinados.length} usuarios`);
      fetchData();
    } catch { toast.error('Error al asignar'); }
    setAsignando(false);
    setTimeout(() => setResultado(''), 4000);
  };

  // ── Control de asignación ──

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Asignar Leads</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {tab === 'pendientes' ? `${disponibles} sin asignar` : `${liberados.length} liberados`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button onClick={() => setTab('pendientes')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'pendientes' ? 'border-[#0a6ea9] text-[#0a6ea9]' : 'border-transparent text-gray-500 dark:text-gray-400'}`}>
          Sin asignar ({disponibles})
        </button>
        <button onClick={() => setTab('liberados')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'liberados' ? 'border-[#0a6ea9] text-[#0a6ea9]' : 'border-transparent text-gray-500 dark:text-gray-400'}`}>
          Liberados ({liberados.length})
        </button>
      </div>

      {tab === 'pendientes' && (
        <>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span
              onClick={() => setCimaFilter(cimaFilter === 'SI' ? null : 'SI')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer select-none transition-all ${
                cimaFilter === 'SI'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
              }`}>CIMA</span>
            <span
              onClick={() => setRenoveFilter(renoveFilter === 'SI' ? null : 'SI')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer select-none transition-all ${
                renoveFilter === 'SI'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
              }`}>Renove</span>
            <span className="text-xs text-gray-400 font-medium">Variantes:</span>
            <div className="flex gap-1 flex-wrap">
              {VARIANTES.map(v => {
                const activa = variantesActivas.includes(v.key);
                const colorMap: Record<string, string> = {
                  emerald: 'border-emerald-300 text-emerald-700 bg-emerald-100',
                  blue: 'border-blue-300 text-blue-700 bg-blue-100',
                  amber: 'border-amber-300 text-amber-700 bg-amber-100',
                  slate: 'border-slate-300 text-slate-700 bg-slate-100',
                };
                return (
                  <button key={v.key} onClick={() => setVariantesActivas(prev =>
                    prev.includes(v.key) ? prev.filter(x => x !== v.key) : [...prev, v.key]
                  )}
                    className={`text-[10px] px-2 py-1 rounded-full border transition-colors font-medium ${
                      activa ? colorMap[v.color] || colorMap.slate : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}>{activa ? '✓' : '○'} {v.label}</button>
                );
              })}
              <span className="text-gray-400 text-xs mx-0.5">|</span>
              {VARIANTES_MENORES.map(v => {
                const activa = variantesActivas.includes(v.key);
                return (
                  <button key={v.key} onClick={() => setVariantesActivas(prev =>
                    prev.includes(v.key) ? prev.filter(x => x !== v.key) : [...prev, v.key]
                  )}
                    className={`text-[10px] px-2 py-1 rounded-full border transition-colors font-medium ${
                      activa ? 'border-slate-300 text-slate-700 bg-slate-100' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}>{activa ? '✓' : '○'} {v.label}</button>
                );
              })}
            </div>
            {(cimaFilter || renoveFilter || variantesActivas.length > 0) && (
              <button onClick={() => { setCimaFilter(null); setRenoveFilter(null); setVariantesActivas([]); }}
                className="text-xs text-[#0a6ea9] hover:underline ml-1">Limpiar</button>
            )}
          </div>
          {/* Chips de subordinados */}
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-gray-400 dark:text-gray-500" /></div>
          ) : disponibles === 0 ? (
            <div className="card text-center py-16">
              <Users size={48} className="text-gray-400 dark:text-gray-500 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No hay leads sin asignar</p>
            </div>
          ) : subordinados.length === 0 ? (
            <div className="card text-center py-16">
              <UserPlus size={48} className="text-gray-400 dark:text-gray-500 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No tenés usuarios a cargo</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Barra de control */}
              <div className="card-sm bg-gray-50 dark:bg-gray-800 flex items-center gap-3 flex-wrap">
                <UserPlus size={16} className="text-[#0a6ea9]" />
                <span className="text-sm font-medium">
                  Asignados: <span className={excede ? 'text-red-600 font-bold' : 'text-[#0a6ea9] font-bold'}>{totalAsignado}</span> / {disponibles}
                </span>
                {excede && <span className="text-xs text-red-500 font-medium">¡Excede los disponibles!</span>}
                <button onClick={repartirIgual} disabled={subordinados.length === 0}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-[#0a6ea9] hover:text-[#0a6ea9] transition-colors flex items-center gap-1">
                  <RotateCcw size={12} /> Repartir igual
                </button>
                <button onClick={asignar} disabled={asignando || totalAsignado === 0 || excede}
                  className="btn-primary flex items-center gap-1.5 text-xs px-4 py-1.5 disabled:opacity-40 ml-auto">
                  {asignando ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  Asignar {totalAsignado > 0 ? totalAsignado : ''} leads
                </button>
                {resultado && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12} /> {resultado}</span>}
              </div>

              {/* Grid de subordinados */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {subordinados.map(sub => {
                  const cant = parseInt(cantidades[String(sub.id)] || '0') || 0;
                  return (
                    <div key={sub.id} className={`card p-4 text-center border-2 transition-all ${cant > 0 ? 'border-[#0a6ea9] bg-[#f0f4ff]' : 'border-gray-200 dark:border-gray-600'}`}>
                      <div className="w-10 h-10 rounded-full bg-[#481163]/10 flex items-center justify-center mx-auto mb-2">
                        <span className="text-[#481163] font-bold text-sm">{sub.nombre[0]}</span>
                      </div>
                      <p className="text-sm font-semibold mb-1">{sub.nombre}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-3">{sub.equipo || 'Sin equipo'} · {sub.pendientes} pend.</p>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cantidades[String(sub.id)] || ''}
                        onChange={e => setCantidad(String(sub.id), e.target.value)}
                        placeholder="0"
                        className={`w-16 text-center border rounded-lg px-2 py-1.5 text-lg font-bold ${
                          cant > 0 ? 'border-[#0a6ea9] text-[#0a6ea9]' : 'border-gray-200 dark:border-gray-600 text-slate-400'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Liberados */}
      {tab === 'liberados' && (
        <div className="card !p-0 overflow-hidden">
          {liberados.length === 0 ? (
            <div className="text-center py-16"><Users size={48} className="text-gray-400 dark:text-gray-500 mx-auto mb-3" /><p className="text-sm text-gray-500 dark:text-gray-400">No hay leads liberados</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <th className="table-header px-3 py-2.5 text-left">DNI</th>
                <th className="table-header px-3 py-2.5 text-left">Nombre</th>
                <th className="table-header px-3 py-2.5 text-left">Asesor anterior</th>
                <th className="table-header px-3 py-2.5 text-left">Liberado</th>
              </tr></thead>
              <tbody>
                {liberados.map(l => (
                  <tr key={l.id_cliente} className="border-b border-[#f0f0f8] hover:bg-gray-50 dark:bg-gray-800 text-xs">
                    <td className="py-2.5 px-3 font-mono font-medium">{l.dni}</td>
                    <td className="py-2.5 px-3 max-w-[200px] truncate">{l.nombre || '—'}</td>
                    <td className="py-2.5 px-3">{l.asesor_anterior}</td>
                    <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400">{l.liberado_at ? new Date(l.liberado_at).toLocaleDateString('es-PE') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
