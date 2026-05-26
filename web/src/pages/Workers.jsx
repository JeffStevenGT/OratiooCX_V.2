import { useState, useEffect } from 'react'
import { Activity, Loader2, Play, Pause, Square, RefreshCw, WifiOff, Clock, Target,
  Search, X, Monitor,
} from 'lucide-react'
import { supabase } from '../supabaseClient'

const statusCfg = {
  activo:   { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400', pulse: true, iconBg: 'bg-emerald-50 text-emerald-600' },
  pausado:  { badge: 'bg-amber-50 text-amber-700 border-amber-200',     dot: 'bg-amber-500',  pulse: false, iconBg: 'bg-amber-50 text-amber-600' },
  conectado: { badge: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-400',   pulse: true,  iconBg: 'bg-blue-50 text-blue-600' },
  detenido: { badge: 'bg-gray-100 text-gray-500 border-[#e8dce6]',        dot: 'bg-gray-300',   pulse: false, iconBg: 'bg-gray-100 text-gray-500' },
}

function formatTiempo(iso) {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  } catch { return '\u2014' }
}

export default function Workers() {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [accionando, setAccionando] = useState(null)

  const loadWorkers = async () => {
    try {
      const { data } = await supabase.from('maquinas').select('*').order('nombre')
      const lista = []
      let totalProc = 0
      for (const m of data || []) {
        const info = m.workers_info || []
        for (const w of info) {
          lista.push({
            id: w.id || '?',
            idStr: 'WRK-' + (w.id || '?'),
            proxy: w.proxy_ip || '\u2014',
            maquina: m.nombre,
            estado: w.estado === 'pausado' ? 'pausado' : (w.estado || (m.estado === 'conectado' ? 'activo' : 'detenido')),
            tiempoActivo: w.activo_desde ? formatTiempo(w.activo_desde) : '\u2014',
            pid: w.pid || '\u2014',
            dniActual: w.dni_actual || '',
          })
        }
        if (info.length === 0 && m.estado === 'conectado') {
          lista.push({
            id: 'maq-' + m.id,
            idStr: m.nombre,
            proxy: '\u2014',
            maquina: m.nombre,
            estado: 'conectado',
            tiempoActivo: m.ultimo_heartbeat ? formatTiempo(m.ultimo_heartbeat) : '\u2014',
            pid: '\u2014',
            dniActual: '',
          })
        }
        const docCount = await supabase.from('documentos').select('procesados').limit(1)
        if (docCount.data && docCount.data.length > 0) {
          totalProc = docCount.data.reduce((s, d) => s + (d.procesados || 0), 0)
        }
      }
      setWorkers(lista)
    } catch (err) {
      console.error('Error cargando workers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkers()
    const interval = setInterval(loadWorkers, 5000)
    return () => clearInterval(interval)
  }, [])

  const enviarComando = async (maquina, comando, workerId = null) => {
    const key = `${maquina}-${comando}-${workerId || ''}`
    setAccionando(key)
    try {
      const params = workerId ? { worker_id: workerId } : {}
      await supabase.from('comandos_bot').insert({
        maquina_destino: maquina,
        comando: comando,
        parametros: params,
        estado: 'pendiente',
      })
      setTimeout(() => setAccionando(null), 1500)
    } catch {
      setAccionando(null)
    }
  }

  const handleToggleWorker = async (w) => {
    const nuevoEstado = w.estado === 'pausado' ? 'reanudar' : 'pausar'
    await enviarComando(w.maquina, nuevoEstado, w.id)
  }

  const handleStopWorker = async (w) => {
    await enviarComando(w.maquina, 'detener', w.id)
  }

  const handleIniciarTodos = () => {
    const maquinas = [...new Set(workers.map(w => w.maquina))]
    for (const m of maquinas) {
      enviarComando(m, 'iniciar')
    }
  }

  const handleDetenerTodos = () => {
    for (const w of workers) {
      if (w.estado !== 'detenido') {
        enviarComando(w.maquina, 'detener', w.id)
      }
    }
  }

  const getBadge = (estado) => {
    const cfg = statusCfg[estado] || statusCfg.detenido
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-normal border ${cfg.badge}`}>
        {cfg.pulse && <span className={`w-1.5 h-1.5 ${cfg.dot} rounded-full animate-pulse`} />}
        {estado === 'detenido' && <WifiOff size={10} />}
        {estado === 'activo' ? 'Activo' : estado === 'pausado' ? 'Pausado' : estado === 'conectado' ? 'En linea' : 'Detenido'}
      </span>
    )
  }

  const stats = {
    activos: workers.filter((w) => w.estado === 'activo' || w.estado === 'conectado').length,
    maquinas: [...new Set(workers.map(w => w.maquina))].length,
    totalWorkers: workers.length,
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-oratioo-purple" /></div>

  const filtered = workers.filter(w =>
    !search || w.idStr.toLowerCase().includes(search.toLowerCase()) ||
    w.maquina.toLowerCase().includes(search.toLowerCase()) ||
    w.dniActual.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7c757c]" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full bg-white border border-[#e8dce6] rounded-lg pl-8 pr-7 py-1.5 text-xs text-[#1a1030] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0a6ea9]/20 focus:border-[#0a6ea9]"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#7c757c] hover:text-[#0a6ea9]">
              <X size={12} />
            </button>
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold text-oratioo-dark">Workers</h1>
          <p className="text-sm text-oratioo-gray mt-1">{filtered.length} workers \u00b7 {stats.activos} activos</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-primary flex items-center gap-2 text-sm" onClick={handleIniciarTodos}><Play size={14} /> Iniciar todos</button>
          <button className="btn-primary flex items-center gap-2 text-sm" onClick={handleDetenerTodos}><Square size={14} /> Detener todos</button>
          <button onClick={loadWorkers} className="btn-primary p-2"><RefreshCw size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Activity, label: 'Workers activos', value: stats.activos, color: 'bg-emerald-50 text-emerald-600' },
          { icon: Monitor, label: 'Maquinas', value: stats.maquinas, color: 'bg-[#e6f3fb] text-[#0a6ea9]' },
          { icon: Clock, label: 'Total workers', value: stats.totalWorkers, color: 'bg-[#e6f3fb] text-[#0a6ea9]' },
        ].map((s, i) => (
          <div key={i} className="card flex items-center gap-4">
            <div className={`p-2.5 rounded-lg ${s.color}`}><s.icon size={18} /></div>
            <div>
              <p className="text-xs text-oratioo-gray">{s.label}</p>
              <p className="text-lg font-semibold text-oratioo-dark">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((w) => {
          const cfg = statusCfg[w.estado] || statusCfg.detenido
          return (
            <div key={w.idStr} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${cfg.iconBg}`}><Activity size={18} /></div>
                  <div>
                    <h3 className="text-sm font-semibold text-oratioo-dark font-mono">{w.idStr}</h3>
                    <p className="text-xs text-oratioo-gray">{w.maquina}</p>
                  </div>
                </div>
                {getBadge(w.estado)}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                {[
                  { label: 'Proxy', value: w.proxy },
                  { label: 'Tiempo', value: w.tiempoActivo },
                  { label: 'PID', value: w.pid },
                ].map((f, i) => (
                  <div key={i} className="bg-oratioo-light rounded-lg px-3 py-2 border border-oratioo-border">
                    <p className="text-[10px] text-oratioo-gray uppercase tracking-wider mb-0.5">{f.label}</p>
                    <p className="text-xs font-mono text-oratioo-dark truncate">{f.value}</p>
                  </div>
                ))}
              </div>

              {w.dniActual && (
                <div className="bg-purple-50 rounded-lg px-3 py-1.5 mb-3 border border-purple-200">
                  <p className="text-[10px] text-purple-600 uppercase tracking-wider mb-0.5">Analizando ahora</p>
                  <p className="text-xs font-mono text-purple-800 font-semibold">{w.dniActual}</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                {w.estado === 'detenido' || w.estado === 'conectado' ? (
                  <button onClick={() => enviarComando(w.maquina, 'iniciar', w.id)}
                    className="btn-success flex items-center gap-1.5 text-xs py-1.5 px-3"
                    disabled={accionando === `${w.maquina}-iniciar-${w.id}`}>
                    {accionando === `${w.maquina}-iniciar-${w.id}` ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Iniciar
                  </button>
                ) : (
                  <button onClick={() => handleToggleWorker(w)}
                    className="btn-success flex items-center gap-1.5 text-xs py-1.5 px-3"
                    disabled={accionando === `${w.maquina}-pausar-${w.id}` || accionando === `${w.maquina}-reanudar-${w.id}`}>
                    {accionando === `${w.maquina}-pausar-${w.id}` || accionando === `${w.maquina}-reanudar-${w.id}`
                      ? <Loader2 size={12} className="animate-spin" />
                      : w.estado === 'pausado' ? <Play size={12} /> : <Pause size={12} />
                    }
                    {w.estado === 'pausado' ? 'Reanudar' : 'Pausar'}
                  </button>
                )}
                {w.estado !== 'detenido' && w.estado !== 'conectado' && (
                  <button onClick={() => handleStopWorker(w)}
                    className="btn-danger flex items-center gap-1.5 text-xs py-1.5 px-3"
                    disabled={accionando === `${w.maquina}-detener-${w.id}`}>
                    {accionando === `${w.maquina}-detener-${w.id}`
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Square size={12} />
                    } Detener
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
