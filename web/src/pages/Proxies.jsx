import { useState, useEffect } from 'react'
import {
  Server,
  Loader2,
  Play,
  Square,
  RefreshCw,
  Globe,
  Wifi,
  WifiOff,
  Minus,
  Search,
  X
} from 'lucide-react'

// Simulated proxy data
const PROXIES_INICIALES = [
  { ip: '192.168.1.10', puerto: 3128, maquina: 'Servidor-01' },
  { ip: '192.168.1.11', puerto: 3128, maquina: 'Servidor-01' },
  { ip: '192.168.1.12', puerto: 3128, maquina: 'Servidor-01' },
  { ip: '192.168.1.20', puerto: 3128, maquina: 'Servidor-02' },
  { ip: '192.168.1.21', puerto: 3128, maquina: 'Servidor-02' },
  { ip: '192.168.2.10', puerto: 8080, maquina: 'Servidor-03' },
  { ip: '192.168.2.11', puerto: 8080, maquina: 'Servidor-03' },
  { ip: '192.168.3.10', puerto: 8888, maquina: 'Proxy-Backup' },
  { ip: '192.168.3.11', puerto: 8888, maquina: 'Proxy-Backup' },
  { ip: '192.168.3.12', puerto: 8888, maquina: 'Proxy-Backup' },
]

const STATUSES = ['activo', 'caido', 'libre']

export default function Proxies() {
  const [proxies, setProxies] = useState([])
  const [loading, setLoading] = useState(true)
  const [numWorkers, setNumWorkers] = useState(2)
  const [workersActivos, setWorkersActivos] = useState([])
  const [iniciando, setIniciando] = useState(false)
  const [search, setSearch] = useState("")


  const loadProxies = () => {
    setLoading(true)
    // Simular carga desde proxies.txt
    setTimeout(() => {
      const mapped = PROXIES_INICIALES.map((p, i) => ({
        ...p,
        id: `proxy-${i}`,
        estado: STATUSES[Math.floor(Math.random() * 3)],
        worker: null,
      }))
      setProxies(mapped)
      setLoading(false)
    }, 500)
  }

  useEffect(() => {
    loadProxies()
  }, [])

  const iniciarWorkers = () => {
    setIniciando(true)
    setTimeout(() => {
      const libres = proxies.filter((p) => p.estado === 'libre')
      const aAsignar = Math.min(numWorkers, libres.length)

      const nuevos = []
      for (let i = 0; i < aAsignar; i++) {
        const workerId = `worker-${Date.now()}-${i}`
        nuevos.push({
          id: workerId,
          proxyId: libres[i].id,
          proxyIp: libres[i].ip,
          estado: 'activo',
          maquina: libres[i].maquina,
        })
      }

      setWorkersActivos((prev) => [...prev, ...nuevos])

      // Actualizar proxies
      setProxies((prev) =>
        prev.map((p) => {
          const asignado = nuevos.find((w) => w.proxyId === p.id)
          if (asignado) {
            return { ...p, estado: 'activo', worker: asignado.id }
          }
          return p
        })
      )
      setIniciando(false)
    }, 800)
  }

  const detenerTodos = () => {
    setWorkersActivos([])
    setProxies((prev) =>
      prev.map((p) => {
        if (p.worker) {
          return { ...p, estado: 'libre', worker: null }
        }
        return p
      })
    )
  }

  const getStatusIcon = (estado) => {
    switch (estado) {
      case 'activo':
        return <Wifi size={14} className="text-emerald-400" />
      case 'caido':
        return <WifiOff size={14} className="text-red-400" />
      case 'libre':
        return <Minus size={14} className="text-oratioo-gray" />
      default:
        return <Minus size={14} className="text-oratioo-gray" />
    }
  }

  const getStatusBadge = (estado) => {
    const base = 'inline-flex items-center rounded-full px-2 py-1 text-xs font-normal'
    switch (estado) {
      case 'activo':
        return <span className={`${base} bg-emerald-50 text-emerald-700 border border-emerald-200`}>Activo</span>
      case 'caido':
        return <span className={`${base} bg-red-50 text-red-700 border border-red-200`}>Caído</span>
      case 'libre':
        return <span className={`${base} bg-gray-100 text-gray-600 border border-[#e8dce6]`}>Libre</span>
      default:
        return <span className={`${base} bg-gray-100 text-gray-600 border border-[#e8dce6]`}>Libre</span>
    }
  }

  const libres = proxies.filter((p) => p.estado === 'libre').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-oratioo-purple" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7c757c]" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full bg-white border border-[#e8dce6] rounded-lg pl-8 pr-7 py-1.5 text-xs text-[#1a1030] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0a6ea9]/20 focus:border-[#0a6ea9]"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#7c757c] hover:text-[#0a6ea9]">
              <X size={12} />
            </button>
          )}
        </div>
                <div>
          <h1 className="text-xl font-bold text-oratioo-dark">Proxies</h1>
          <p className="text-sm text-oratioo-gray mt-1">
            {proxies.length} proxies registrados — {libres} libres, {workersActivos.length} activos
          </p>
        </div>
        <button onClick={loadProxies} className="btn-primary p-2">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Worker controls */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs text-oratioo-gray">Workers a iniciar:</label>
            <input
              type="number"
              min={1}
              max={libres}
              value={numWorkers}
              onChange={(e) => setNumWorkers(Math.max(1, Math.min(libres, parseInt(e.target.value) || 1)))}
              className="input-field w-20 text-center text-sm"
            />
          </div>

          <button
            onClick={iniciarWorkers}
            disabled={iniciando || libres === 0 || numWorkers < 1}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {iniciando ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Iniciar workers
          </button>

          <button
            onClick={detenerTodos}
            disabled={workersActivos.length === 0}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Square size={14} />
            Detener todos
          </button>

          <span className="text-xs text-oratioo-gray">
            {workersActivos.length} worker{workersActivos.length !== 1 ? 's' : ''} activo{workersActivos.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Proxy table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-oratioo-border">
                <th className="table-header px-4 py-3">IP</th>
                <th className="table-header px-4 py-3">Puerto</th>
                <th className="table-header px-4 py-3">Estado</th>
                <th className="table-header px-4 py-3">Worker Asignado</th>
                <th className="table-header px-4 py-3">Máquina</th>
              </tr>
            </thead>
            <tbody>
              {proxies.map((p) => (
                <tr key={p.id} className="border-b border-oratioo-border hover:bg-oratioo-light/50 transition-colors">
                  <td className="table-cell font-mono text-xs">{p.ip}</td>
                  <td className="table-cell text-xs">{p.puerto}</td>
                  <td className="table-cell">{getStatusBadge(p.estado)}</td>
                  <td className="table-cell text-xs text-oratioo-gray font-mono">
                    {p.worker || '—'}
                  </td>
                  <td className="table-cell text-xs text-oratioo-gray">{p.maquina}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
