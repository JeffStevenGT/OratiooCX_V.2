import { useState, useEffect } from 'react'
import { Activity, Loader2, ChevronDown, ChevronUp, Play, Pause, Square, WifiOff } from 'lucide-react'
import { supabase } from '../supabaseClient'

const statusCfg = {
  activo:  { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400', pulse: true,  label: 'Activo' },
  pausado: { badge: 'bg-amber-50 text-amber-700 border-amber-200',     dot: 'bg-amber-500',  pulse: false, label: 'Pausado' },
  sin_pid: { badge: 'bg-gray-100 text-gray-400 border-gray-200',       dot: 'bg-gray-300',   pulse: false, label: 'Sin señal' },
  error:   { badge: 'bg-red-50 text-red-700 border-red-200',           dot: 'bg-red-400',    pulse: false, label: 'Error' },
}

/** Determina el estado real del worker:
 *  - Si dice "activo" pero no tiene PID -> es stale (sin_pid)
 *  - Si dice "activo" pero sin activo_desde -> stale
 *  - Sino, devuelve el estado que reporta */
function estadoReal(w) {
  if (w.estado === 'activo' && (!w.pid || !w.activo_desde)) {
    return 'sin_pid'
  }
  return w.estado || 'sin_pid'
}

export default function BotStatus() {
  const [maquinas, setMaquinas] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [accionEjecutando, setAccionEjecutando] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase.from('maquinas').select('*')
        setMaquinas(data || [])
      } catch {}
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  const MAQUINA_TIMEOUT_MS = 30_000 // 30s sin heartbeat = offline

  function maquinaOnline(m) {
    // Online solo si el heartbeat es reciente (< 30s)
    if (!m.ultimo_heartbeat) return false
    const diff = Date.now() - new Date(m.ultimo_heartbeat).getTime()
    return diff < MAQUINA_TIMEOUT_MS
  }

  const totalWorkers = maquinas.reduce((sum, m) => sum + (m.workers_activos || 0), 0)
  const onlineCount = maquinas.filter(maquinaOnline).length

  const enviarComando = async (maquinaNombre, comando, workerId = null) => {
    const key = `${maquinaNombre}-${comando}-${workerId || ''}`
    setAccionEjecutando(key)
    try {
      const params = workerId ? { worker_id: workerId } : {}
      await supabase.from('comandos_bot').insert({
        maquina_destino: maquinaNombre,
        comando,
        parametros: params,
        estado: 'pendiente',
      })
      setTimeout(() => setAccionEjecutando(null), 1500)
    } catch {}
  }

  return (
    <div className="card !p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-oratioo-dark flex items-center gap-1.5">
          <Activity size={12} className="text-oratioo-purple" />
          Estado de la App
        </h3>
        {loading ? (
          <Loader2 size={12} className="animate-spin text-oratioo-gray" />
        ) : (
          <span className="text-[10px] text-oratioo-gray">
            {onlineCount > 0 ? (
              <span className="text-emerald-600 font-medium">{onlineCount} máquina{onlineCount !== 1 ? 's' : ''} activa{onlineCount !== 1 ? 's' : ''}</span>
            ) : (
              <span className="text-oratioo-gray">Sin máquinas activas</span>
            )}
            {' · '}{totalWorkers} worker{totalWorkers !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {maquinas.length > 0 && (
        <div className="space-y-1">
          {maquinas.map(m => {
            const isOnline = maquinaOnline(m)
            const isExpanded = expanded === m.id
            const workers = m.workers_info || []

            // Estado real de cada worker:
            // - Si la máquina está offline, todos son "sin señal" automaticamente
            // - Si está online, usa la detección de zombies (PID ausente)
            const workersConEstado = workers.map(w => ({
              ...w,
              _estadoReal: isOnline ? estadoReal(w) : 'sin_pid'
            }))

            // Detectar si hay workers trabajando activamente (con DNI asignado)
            const algunoTrabajando = workersConEstado.some(w => w._estadoReal === 'activo' && w.dni_actual)
            const activos = workersConEstado.filter(w => w._estadoReal === 'activo').length
            const pausados = workersConEstado.filter(w => w._estadoReal === 'pausado').length
            const sinPid = workersConEstado.filter(w => w._estadoReal === 'sin_pid').length
            const hayReales = activos + pausados > 0

            return (
              <div key={m.id} className="bg-oratioo-light/40 rounded-lg border border-oratioo-border">
                <div className="flex items-center justify-between w-full px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300'}`} />
                    <span className="font-medium text-oratioo-dark">{m.nombre}</span>
                    {isOnline ? (
                      <>
                        <span className="text-emerald-600 text-[10px]">Online</span>
                        {algunoTrabajando && (
                          <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            Trabajando
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400 text-[10px]">Offline</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Contador funcional */}
                    <span className="text-[10px] text-oratioo-gray">
                      {hayReales ? (
                        <>
                          <span className="text-emerald-600 font-semibold">{activos} activos</span>
                          {pausados > 0 && <span className="text-amber-600 font-semibold ml-1">· {pausados} pausados</span>}
                        </>
                      ) : sinPid > 0 ? (
                        <span className="text-gray-400">{sinPid} sin señal</span>
                      ) : workers.length > 0 ? (
                        <span className="text-oratioo-gray">sin agentes activos</span>
                      ) : (
                        <span>{m.workers_activos || 0} workers</span>
                      )}
                    </span>

                    {/* Botones de acción — solo si hay workers reales */}
                    {isOnline && hayReales && (
                      <>
                        {activos > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); enviarComando(m.nombre, 'pausar_todos'); }}
                            disabled={accionEjecutando === `${m.nombre}-pausar_todos-`}
                            className="p-1 rounded hover:bg-amber-50 text-amber-600 transition-colors disabled:opacity-30"
                            title="Pausar todos los workers"
                          >
                            {accionEjecutando === `${m.nombre}-pausar_todos-` ? <Loader2 size={12} className="animate-spin" /> : <Pause size={12} />}
                          </button>
                        )}
                        {pausados > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); enviarComando(m.nombre, 'reanudar_todos'); }}
                            disabled={accionEjecutando === `${m.nombre}-reanudar_todos-`}
                            className="p-1 rounded hover:bg-emerald-50 text-emerald-600 transition-colors disabled:opacity-30"
                            title="Reanudar todos los workers"
                          >
                            {accionEjecutando === `${m.nombre}-reanudar_todos-` ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); enviarComando(m.nombre, 'detener_todos'); }}
                          disabled={accionEjecutando === `${m.nombre}-detener_todos-`}
                          className="p-1 rounded hover:bg-red-50 text-red-500 transition-colors disabled:opacity-30"
                          title="Detener todos los workers"
                        >
                          {accionEjecutando === `${m.nombre}-detener_todos-` ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />}
                        </button>
                      </>
                    )}

                    {workers.length > 0 && (
                      <button
                        onClick={() => setExpanded(isExpanded ? null : m.id)}
                        className="p-0.5 text-oratioo-gray hover:text-oratioo-dark transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && workers.length > 0 && (
                  <div className="px-3 pb-2 space-y-1.5 border-t border-oratioo-border pt-2 mt-0">
                    {workersConEstado.map((w, i) => {
                      const cfg = statusCfg[w._estadoReal] || statusCfg.sin_pid
                      return (
                        <div key={`${m.nombre}-${w.id || i}`} className="bg-white rounded-lg p-2 border border-oratioo-border">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-semibold text-oratioo-dark">
                                Worker #{w.id || (i + 1)}
                              </span>
                              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${cfg.badge}`}>
                                {cfg.pulse && <span className={`w-1.5 h-1.5 ${cfg.dot} rounded-full animate-pulse`} />}
                                {cfg.label}
                              </span>
                            </div>
                          </div>
                          {w.dni_actual && (
                            <div className="text-[10px] text-oratioo-purple font-mono mb-1">
                              Analizando: {w.dni_actual}
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-2 text-[10px] text-oratioo-gray">
                            <span>Proxy: {w.proxy_ip || w.proxy || '—'}</span>
                            <span>PID: {w.pid || '—'}</span>
                            <span>Activo: {w.activo_desde ? new Date(w.activo_desde).toLocaleTimeString('es') : '—'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!loading && maquinas.length === 0 && (
        <p className="text-[11px] text-oratioo-gray text-center py-2">
          No hay máquinas configuradas. Ve a Configurar App.
        </p>
      )}
    </div>
  )
}
