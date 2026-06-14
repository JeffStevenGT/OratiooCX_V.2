/**
 * app/(dashboard)/fichaje/page.tsx — Fichaje Electrónico v1
 * Normativa España RD-ley 8/2019
 * 
 * Asesor: botón entrada/salida + historial personal
 * Supervisor/Jefe/Dev/BO/IT: vista del equipo + descarga con filtros
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { LogIn, LogOut, Download, Clock, Users, AlertTriangle, UserPlus, Building2, Home } from 'lucide-react';
import { toast } from '@/components/shared/Toast';

type Fichaje = {
  id: number; usuario_id: number; tipo: string; timestamp: string;
  metodo: string; notas: string; usuario_nombre: string; usuario_email: string;
};

type MiembroEquipo = {
  id: number; nombre: string; email: string; equipo: string;
  entrada: string | null; salida: string | null;
  segundos_pausa: number; segundos_trabajados: number;
  estado: 'sin_fichar' | 'trabajando' | 'completado';
};

const ROLES_EQUIPO = ['supervisor', 'jefe_area', 'desarrollador', 'it', 'back_office'];

function fmtHora(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function fmtDuracion(seg: number) {
  if (seg <= 0) return '—';
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function fmtPausa(seg: number) {
  if (seg <= 0) return '—';
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function FichajePage() {
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  // Estado personal
  const [ultimoFichaje, setUltimoFichaje] = useState<Fichaje | null>(null);
  const [entradaHoy, setEntradaHoy] = useState<string | null>(null);
  const [enJornada, setEnJornada] = useState(false);
  const [reloj, setReloj] = useState('');
  const [segundosTrabajados, setSegundosTrabajados] = useState(0);
  const [modalidad, setModalidad] = useState<'presencial' | 'remoto'>('presencial');

  // Historial
  const [historial, setHistorial] = useState<Fichaje[]>([]);
  const [mes, setMes] = useState(() => new Date().toISOString().substring(0, 7));

  // Vista equipo
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  const [tab, setTab] = useState<'personal' | 'equipo'>('personal');

  // Filtros descarga
  const [fDesde, setFDesde] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [fHasta, setFHasta] = useState(() => new Date().toISOString().split('T')[0]);

  // Registro manual supervisor
  const [showManual, setShowManual] = useState(false);
  const [manualUserId, setManualUserId] = useState('');
  const [manualTipo, setManualTipo] = useState<'entrada' | 'salida'>('entrada');
  const [manualHora, setManualHora] = useState('');
  const [manualMotivo, setManualMotivo] = useState('');

  // Reloj en tiempo real
  useEffect(() => {
    const t = setInterval(() => {
      setReloj(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      if (enJornada) setSegundosTrabajados(s => s + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [enJornada]);

  const fetchData = useCallback(async () => {
    try {
      const sRes = await fetch('/api/auth/session');
      const s = await sRes.json();
      const role = s?.user?.role || 'asesor';
      const uid = s?.user?.id;
      setUserRole(role);
      setUserId(uid);

      // Historial del mes
      const ahora = new Date();
      const hoyInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).toISOString();
      const hoyFin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1).toISOString();
      const hRes = await fetch(`/api/fichajes?mes=${mes}&hoy=${encodeURIComponent(hoyInicio)}&hoy_fin=${encodeURIComponent(hoyFin)}`);
      if (hRes.ok) {
        const data = await hRes.json();
        setHistorial(data);

        // Determinar estado de jornada (del día actual)
        const hoyStr = ahora.toISOString().split('T')[0];
        const fichajesHoy = data.filter((f: Fichaje) => {
          const fDate = new Date(f.timestamp).toISOString().split('T')[0];
          return fDate === hoyStr;
        });
        if (fichajesHoy.length > 0) {
          const ultimo = fichajesHoy[0]; // ordenados DESC
          setUltimoFichaje(ultimo);
          if (ultimo.tipo === 'entrada') setEnJornada(true);
          else setEnJornada(false);

          const entrada = fichajesHoy.find((f: Fichaje) => f.tipo === 'entrada');
          setEntradaHoy(entrada?.timestamp || null);
        } else {
          setUltimoFichaje(null);
          setEnJornada(false);
          setEntradaHoy(null);
        }
      }

      // Equipo (si aplica)
      if (ROLES_EQUIPO.includes(role)) {
        setTab('equipo');
        const ahora = new Date();
        const fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).toISOString();
        const fechaFin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1).toISOString();
        const eRes = await fetch(`/api/fichajes/equipo?fecha=${encodeURIComponent(fechaInicio)}&fecha_fin=${encodeURIComponent(fechaFin)}`);
        if (eRes.ok) setEquipo(await eRes.json());
      } else {
        setTab('personal');
      }
    } catch { /* */ }
    setLoading(false);
  }, [mes]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fichar = async (tipo: 'entrada' | 'salida') => {
    setEnviando(true);
    try {
      const res = await fetch('/api/fichajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, timestamp: new Date().toISOString(), modalidad }),
      });

      if (res.ok) {
        toast.success(tipo === 'entrada' ? '✅ Entrada registrada' : '✅ Salida registrada');
        setEnJornada(tipo === 'entrada');
        if (tipo === 'salida') setEntradaHoy(null);
        fetchData();
        // Sincronizar pendientes offline
        sincronizarPendientes();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Error al registrar');
      }
    } catch {
      // Guardar offline
      const pendientes = JSON.parse(localStorage.getItem('fichajes_pendientes') || '[]');
      pendientes.push({ tipo, timestamp: new Date().toISOString(), modalidad });
      localStorage.setItem('fichajes_pendientes', JSON.stringify(pendientes));
      toast.warning('⚠️ Fichaje guardado localmente. Se sincronizará al reconectar.');
      if (tipo === 'entrada') setEnJornada(true);
    }
    setEnviando(false);
  };

  const sincronizarPendientes = async () => {
    const pendientes = JSON.parse(localStorage.getItem('fichajes_pendientes') || '[]');
    if (pendientes.length === 0) return;
    const pendientesResueltos: any[] = [];
    for (const p of pendientes) {
      try {
        await fetch('/api/fichajes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p),
        });
      } catch { pendientesResueltos.push(p); }
    }
    localStorage.setItem('fichajes_pendientes', JSON.stringify(pendientesResueltos));
    if (pendientesResueltos.length < pendientes.length) fetchData();
  };

  const ficharManual = async () => {
    if (!manualUserId || !manualMotivo) { toast.error('Completa todos los campos'); return; }
    setEnviando(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const timestamp = manualHora ? `${today}T${manualHora}:00` : new Date().toISOString();
      const res = await fetch('/api/fichajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: manualTipo, timestamp, target_user_id: manualUserId, motivo: manualMotivo }),
      });
      if (res.ok) {
        toast.success('✅ Fichaje manual registrado');
        setShowManual(false);
        setManualMotivo('');
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Error');
      }
    } catch { toast.error('Error de conexión'); }
    setEnviando(false);
  };

  const descargarCSV = () => {
    window.open(`/api/fichajes?desde=${fDesde}&hasta=${fHasta}&exportar=csv`, '_blank');
  };

  // Determinar pendientes offline
  const pendientesOffline = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('fichajes_pendientes') || '[]').length : 0;

  if (loading) return <div className="p-6 text-gray-500">Cargando...</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fichaje</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Registro de jornada — RD-ley 8/2019
          </p>
        </div>
        <div className="flex gap-2">
          {ROLES_EQUIPO.includes(userRole) && (
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button onClick={() => setTab('personal')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  tab === 'personal' ? 'bg-white dark:bg-gray-700 shadow-sm font-medium' : 'text-gray-500'
                }`}>
                Mi Fichaje
              </button>
              <button onClick={() => setTab('equipo')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  tab === 'equipo' ? 'bg-white dark:bg-gray-700 shadow-sm font-medium' : 'text-gray-500'
                }`}>
                Equipo
              </button>
            </div>
          )}
          {ROLES_EQUIPO.includes(userRole) && (
            <button onClick={descargarCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* Pendientes offline */}
      {pendientesOffline > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-amber-700 dark:text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4" />
          Tienes {pendientesOffline} fichaje(s) pendiente(s) de sincronizar. Se enviarán automáticamente al reconectar.
        </div>
      )}

      {/* TAB: Personal */}
      {tab === 'personal' && (
        <div className="space-y-6">
          {/* Reloj + Botón */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 flex flex-col items-center gap-6">
            <div className="text-6xl font-mono font-bold text-gray-900 dark:text-white tabular-nums">
              {reloj}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>

            {enJornada && entradaHoy && (
              <div className="text-center space-y-1">
                <p className="text-sm text-gray-500">Entrada: {fmtHora(entradaHoy)}</p>
                <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                  Tiempo trabajado: {fmtDuracion(segundosTrabajados)}
                </p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  modalidad === 'presencial' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                }`}>
                  {modalidad === 'presencial' ? <><Building2 className="w-3 h-3" /> Presencial</> : <><Home className="w-3 h-3" /> Remoto</>}
                </span>
              </div>
            )}

            {/* Toggle modalidad (Ley 10/2021 — trabajo a distancia) */}
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button onClick={() => setModalidad('presencial')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  modalidad === 'presencial'
                    ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-700 dark:text-blue-300'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}>
                <Building2 className="w-4 h-4" /> Presencial
              </button>
              <button onClick={() => setModalidad('remoto')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  modalidad === 'remoto'
                    ? 'bg-white dark:bg-gray-600 shadow-sm text-purple-700 dark:text-purple-300'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}>
                <Home className="w-4 h-4" /> Remoto
              </button>
            </div>

            {!enJornada && (
              <button onClick={() => fichar('entrada')} disabled={enviando}
                className="w-48 h-48 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white font-bold text-xl flex flex-col items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl">
                {enviando ? (
                  <div className="animate-spin w-8 h-8 border-3 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    <LogIn className="w-10 h-10" />
                    ENTRADA
                  </>
                )}
              </button>
            )}

            {enJornada && (
              <button onClick={() => fichar('salida')} disabled={enviando}
                className="w-48 h-48 rounded-full bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-bold text-xl flex flex-col items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl">
                {enviando ? (
                  <div className="animate-spin w-8 h-8 border-3 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    <LogOut className="w-10 h-10" />
                    SALIDA
                  </>
                )}
              </button>
            )}
          </div>

          {/* Historial */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">Historial</h2>
              <input type="month" value={mes}
                onChange={e => setMes(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-left">Hora</th>
                    <th className="px-4 py-3 text-left">Método</th>
                    <th className="px-4 py-3 text-left">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {historial.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Sin fichajes este mes</td></tr>
                  )}
                  {historial.map((f: Fichaje) => (
                    <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3">{new Date(f.timestamp).toLocaleDateString('es-ES')}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          f.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {f.tipo === 'entrada' ? <LogIn className="w-3 h-3 mr-1" /> : <LogOut className="w-3 h-3 mr-1" />}
                          {f.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">{fmtHora(f.timestamp)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {f.metodo === 'supervisor' ? '👤 Supervisor' : f.metodo === 'auto_login' ? '🤖 Auto' : '📱 Manual'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-40 truncate">{f.notas || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Equipo */}
      {tab === 'equipo' && ROLES_EQUIPO.includes(userRole) && (
        <div className="space-y-6">
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 uppercase">Fichados</p>
              <p className="text-2xl font-bold text-emerald-600">{equipo.filter(e => e.entrada).length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 uppercase">Trabajando</p>
              <p className="text-2xl font-bold text-blue-600">{equipo.filter(e => e.estado === 'trabajando').length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 uppercase">Sin Fichar</p>
              <p className="text-2xl font-bold text-red-600">{equipo.filter(e => e.estado === 'sin_fichar').length}</p>
            </div>
          </div>

          {/* Registro manual */}
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-900 dark:text-white">Equipo hoy</h2>
            <button onClick={() => setShowManual(!showManual)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <UserPlus className="w-4 h-4" /> Registrar manual
            </button>
          </div>

          {showManual && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Registro manual de fichaje</p>
              <div className="grid grid-cols-2 gap-3">
                <select value={manualUserId} onChange={e => setManualUserId(e.target.value)}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm">
                  <option value="">Seleccionar usuario...</option>
                  {equipo.map(e => <option key={e.id} value={e.id}>{e.nombre} ({e.email})</option>)}
                </select>
                <select value={manualTipo} onChange={e => setManualTipo(e.target.value as any)}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm">
                  <option value="entrada">Entrada</option>
                  <option value="salida">Salida</option>
                </select>
                <input type="time" value={manualHora} onChange={e => setManualHora(e.target.value)}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm"
                  placeholder="Hora (opcional, default ahora)" />
                <input type="text" value={manualMotivo} onChange={e => setManualMotivo(e.target.value)}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm"
                  placeholder="Motivo (obligatorio)" />
              </div>
              <button onClick={ficharManual} disabled={enviando}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white text-sm rounded-lg transition-colors">
                {enviando ? 'Registrando...' : 'Registrar fichaje manual'}
              </button>
            </div>
          )}

          {/* Tabla equipo */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Usuario</th>
                  <th className="px-4 py-3 text-left">Equipo</th>
                  <th className="px-4 py-3 text-left">Entrada</th>
                  <th className="px-4 py-3 text-left">Salida</th>
                  <th className="px-4 py-3 text-left">Pausas</th>
                  <th className="px-4 py-3 text-left">Trabajado</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {equipo.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Cargando...</td></tr>
                )}
                {equipo.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 font-medium">{m.nombre}</td>
                    <td className="px-4 py-3 text-gray-500">{m.equipo || '—'}</td>
                    <td className="px-4 py-3 font-mono text-emerald-600">{fmtHora(m.entrada)}</td>
                    <td className="px-4 py-3 font-mono text-red-600">{fmtHora(m.salida)}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtPausa(m.segundos_pausa)}</td>
                    <td className="px-4 py-3 font-mono font-medium">{fmtDuracion(m.segundos_trabajados)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.estado === 'trabajando' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        m.estado === 'completado' ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {m.estado === 'trabajando' ? <Clock className="w-3 h-3" /> :
                         m.estado === 'sin_fichar' ? <AlertTriangle className="w-3 h-3" /> :
                         <Users className="w-3 h-3" />}
                        {m.estado === 'sin_fichar' ? 'Sin fichar' :
                         m.estado === 'trabajando' ? 'Trabajando' : 'Completado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Descarga con filtros */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-sm mb-3">Descargar reporte</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Desde</label>
                <input type="date" value={fDesde} onChange={e => setFDesde(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Hasta</label>
                <input type="date" value={fHasta} onChange={e => setFHasta(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm" />
              </div>
              <div className="pt-5">
                <button onClick={descargarCSV}
                  className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
                  <Download className="w-4 h-4" /> Descargar CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
