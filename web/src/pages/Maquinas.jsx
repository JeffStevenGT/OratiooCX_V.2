import { useState } from 'react'
import {
  Monitor,
  Plus,
  Loader2,
  Wifi,
  WifiOff,
  AlertTriangle,
  Search,
  X
} from 'lucide-react'

const MAQUINAS_INICIALES = [
  { id: 'maq-01', nombre: 'Servidor-01', ip: '192.168.1.10', workers_activos: 3, proxies_asignados: 2, estado: 'online', cpu: 45, ram: 62 },
  { id: 'maq-02', nombre: 'Servidor-02', ip: '192.168.1.20', workers_activos: 2, proxies_asignados: 2, estado: 'online', cpu: 28, ram: 41 },
  { id: 'maq-03', nombre: 'Servidor-03', ip: '192.168.2.10', workers_activos: 1, proxies_asignados: 2, estado: 'warning', cpu: 78, ram: 81 },
  { id: 'maq-04', nombre: 'Proxy-Backup', ip: '192.168.3.10', workers_activos: 0, proxies_asignados: 3, estado: 'offline', cpu: 0, ram: 0 },
]

export default function Maquinas() {
  const [maquinas, setMaquinas] = useState(MAQUINAS_INICIALES)
  const [showRegister, setShowRegister] = useState(false)
  const [newMachine, setNewMachine] = useState({ nombre: '', ip: '' })
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")


  const handleRegister = () => {
    if (!newMachine.nombre || !newMachine.ip) return
    setLoading(true)
    setTimeout(() => {
      setMaquinas((prev) => [...prev, { id: `maq-${Date.now()}`, nombre: newMachine.nombre, ip: newMachine.ip, workers_activos: 0, proxies_asignados: 0, estado: 'offline', cpu: 0, ram: 0 }])
      setNewMachine({ nombre: '', ip: '' })
      setShowRegister(false)
      setLoading(false)
    }, 500)
  }

  const statusConfig = {
    online:  { icon: Wifi, label: 'Online',  dot: 'bg-[#0a6ea9]', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    warning: { icon: AlertTriangle, label: 'Advertencia', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    offline: { icon: WifiOff, label: 'Offline', dot: 'bg-gray-300', badge: 'bg-gray-100 text-gray-500 border-[#e8dce6]' },
  }

  const barColor = (val) => val > 80 ? 'bg-red-400' : val > 60 ? 'bg-amber-400' : 'bg-emerald-400'

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
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#7c757c] hover:text-[#0a6ea9]">
              <X size={12} />
            </button>
          )}
        </div>
                <div>
          <h1 className="text-xl font-bold text-oratioo-dark">Máquinas</h1>
          <p className="text-sm text-oratioo-gray mt-1">
            {maquinas.filter((m) => m.estado === 'online').length} online ·{' '}
            {maquinas.filter((m) => m.estado === 'warning').length} advertencia ·{' '}
            {maquinas.filter((m) => m.estado === 'offline').length} offline
          </p>
        </div>
        <button onClick={() => setShowRegister(!showRegister)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Registrar máquina
        </button>
      </div>

      {showRegister && (
        <div className="card animate-fade-in">
          <h3 className="text-sm font-semibold text-oratioo-dark mb-3">Nueva máquina</h3>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-oratioo-gray mb-1">Nombre</label>
              <input type="text" value={newMachine.nombre} onChange={(e) => setNewMachine((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Servidor-04" className="input-field text-sm" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-oratioo-gray mb-1">Dirección IP</label>
              <input type="text" value={newMachine.ip} onChange={(e) => setNewMachine((p) => ({ ...p, ip: e.target.value }))} placeholder="Ej: 192.168.1.30" className="input-field text-sm font-mono" />
            </div>
            <button onClick={handleRegister} disabled={loading || !newMachine.nombre || !newMachine.ip} className="btn-primary flex items-center gap-2 text-sm">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Registrar
            </button>
            <button onClick={() => setShowRegister(false)} className="btn-secondary text-sm">Cancelar</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {maquinas.map((m) => {
          const sc = statusConfig[m.estado] || statusConfig.offline
          const Icon = sc.icon
          return (
            <div key={m.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${sc.dot}`} />
                  <div>
                    <h3 className="text-sm font-semibold text-oratioo-dark">{m.nombre}</h3>
                    <p className="text-xs text-oratioo-gray font-mono">{m.ip}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-normal border ${sc.badge}`}>
                  <Icon size={12} />{sc.label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-oratioo-gray mb-0.5">Workers activos</p>
                  <p className="text-lg font-semibold text-oratioo-dark">{m.workers_activos}</p>
                </div>
                <div>
                  <p className="text-xs text-oratioo-gray mb-0.5">Proxies asignados</p>
                  <p className="text-lg font-semibold text-oratioo-dark">{m.proxies_asignados}</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {['CPU', 'RAM'].map((label) => {
                  const val = label === 'CPU' ? m.cpu : m.ram
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-oratioo-gray">{label}</span>
                        <span className="text-xs text-oratioo-dark tabular-nums">{val}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-oratioo-light rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${barColor(val)}`} style={{ width: `${val}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
