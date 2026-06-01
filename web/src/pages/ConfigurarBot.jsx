import { useState, useEffect } from 'react'
import {
  Settings, Monitor, Plus, X, Loader2, RefreshCw, Wifi, Trash2, Play, Save, Upload, CheckCircle2, Pencil
} from 'lucide-react'
import { supabase } from '../supabaseClient'


export default function ConfigurarBot() {
  const [machines, setMachines] = useState([])
  const [proxies, setProxies] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [proxiesShowAdd, setProxiesShowAdd] = useState(false)
  const [proxiesNewIp, setProxiesNewIp] = useState('')
  const [proxiesNewPuerto, setProxiesNewPuerto] = useState('3128')
  const [proxiesNewUser, setProxiesNewUser] = useState('')
  const [proxiesNewPass, setProxiesNewPass] = useState('')
  const [proxiesBulk, setProxiesBulk] = useState('')
  const [proxiesAdding, setProxiesAdding] = useState(false)
  const [proxiesPage, setProxiesPage] = useState(1)
  const proxiesPerPage = 10

  // ── Load data ──────────────────────────────────────────────────────
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [maqRes, proxRes] = await Promise.all([
        supabase.from('maquinas').select('*'),
        supabase.from('proxies').select('*'),
      ])
      if (maqRes.error) throw maqRes.error
      if (proxRes.error) throw proxRes.error

      const mappedMachines = (maqRes.data || []).map((m) => ({
        id: m.id,
        nombre: m.nombre || '',
        ip: m.ip || '',
        workers: m.workers_config ?? 1,
      }))

      const mappedProxies = (proxRes.data || []).map((p) => ({
        id: p.id,
        ip: p.ip,
        puerto: p.puerto,
        estado: p.estado || 'libre',
      }))

      // If no machines exist, seed with one blank row
      if (mappedMachines.length === 0) {
        mappedMachines.push(blankMachine())
      }

      setMachines(mappedMachines)
      setProxies(mappedProxies)
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────

  const blankMachine = () => ({
    id: null,
    nombre: '',
    ip: '',
    workers: 1,
    editando: false,
  })

  const totalWorkers = machines.reduce((sum, m) => sum + (parseInt(m.workers) || 0), 0)
  const freeProxies = proxies.filter((p) => p.estado === 'libre').length

  const proxyOptions = proxies.map((p) => {
    const uid = p.id || `${p.ip}:${p.puerto}`
    return {
      value: String(uid),
      label: `${p.ip}:${p.puerto}${p.estado !== 'libre' ? ` (${p.estado})` : ''}`,
      disabled: p.estado !== 'libre',
    }
  })

  // Add a free "ninguno" option
  proxyOptions.unshift({ value: '', label: '— Ninguno —', disabled: false })

  // ── Machine row helpers ────────────────────────────────────────────

  const updateMachine = (index, field, value) => {
    setMachines((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const addMachine = () => {
    setMachines((prev) => [...prev, blankMachine()])
  }

  const removeMachine = async (index) => {
    const machine = machines[index]
    if (machine.id) {
      try {
        const { error } = await supabase.from('maquinas').delete().eq('id', machine.id)
        if (error) throw error
      } catch (err) {
        console.error('Error eliminando máquina:', err)
        return
      }
    }
    setMachines((prev) => prev.filter((_, i) => i !== index))
  }

  const addProxy = async () => {
    setProxiesAdding(true)
    try {
      let proxiesToInsert = []

      // Bulk import from textarea
      if (proxiesBulk.trim()) {
        const lines = proxiesBulk.trim().split('\n').filter(Boolean)
        for (const line of lines) {
          // Format: ip:puerto:usuario:contraseña (limpia quotes, comas, espacios)
          const cleaned = line.trim().replace(/^["\s]+|["\s,]+$/g, '')
          if (!cleaned) continue
          const parts = cleaned.split(':')
          if (parts.length >= 2) {
            proxiesToInsert.push({
              ip: parts[0],
              puerto: parseInt(parts[1]) || 0,
              maquina: parts.slice(2).join(':') || '',
              estado: 'libre',
            })
          }
        }
      } else if (proxiesNewIp && proxiesNewPuerto) {
        // Single proxy
        proxiesToInsert.push({
          ip: proxiesNewIp,
          puerto: parseInt(proxiesNewPuerto),
          maquina: (proxiesNewUser || proxiesNewPass) ? `${proxiesNewUser}:${proxiesNewPass}` : '',
          estado: 'libre',
        })
      }

      if (proxiesToInsert.length === 0) {
        alert('Ingresa al menos un proxy válido.')
        setProxiesAdding(false)
        return
      }

      const { error } = await supabase.from('proxies').insert(proxiesToInsert)
      if (error) throw error

      setProxiesShowAdd(false)
      setProxiesNewIp('')
      setProxiesNewPuerto('3128')
      setProxiesNewUser('')
      setProxiesNewPass('')
      setProxiesBulk('')
      await loadData()
    } catch (err) {
      console.error('Error añadiendo proxy:', err)
      alert('Error al guardar los proxies')
    } finally {
      setProxiesAdding(false)
    }
  }

  // ── Loading state ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-oratioo-purple" />
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-oratioo-dark flex items-center gap-2">
            <Settings size={22} className="text-oratioo-purple" />
            Configurar App
          </h1>
          <p className="text-sm text-oratioo-gray mt-1">
            Define las máquinas y workers de la App
          </p>
        </div>
        <button onClick={loadData} className="btn-primary p-2" title="Recargar datos">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Machine list */}
      {machines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Monitor size={36} className="text-oratioo-gray mb-3" />
          <p className="text-sm text-oratioo-gray mb-4">No hay máquinas configuradas</p>
          <button onClick={addMachine} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Agregar PC
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {machines.map((machine, index) => (
            <div key={index} className="card overflow-hidden">
              {/* Row header */}
              <div className="flex items-center justify-between bg-oratioo-light/60 px-4 py-2 border-b border-oratioo-border">
                <div className="flex items-center gap-2">
                  <Monitor size={16} className="text-oratioo-purple" />
                  {/* Nombre: editable si no guardado o en modo edicion */}
                  {machine.id && !machine.editando ? (
                    <span className="text-sm font-semibold text-oratioo-dark px-1">{machine.nombre}</span>
                  ) : (
                    <input
                      type="text"
                      value={machine.nombre}
                      onChange={(e) => updateMachine(index, 'nombre', e.target.value)}
                      placeholder="Nombre PC"
                      className="bg-transparent border-b border-dashed border-gray-300 text-sm font-semibold text-oratioo-dark focus:outline-none focus:border-oratioo-purple px-1 py-0.5 min-w-[100px]"
                    />
                  )}</div>
                <div className="flex items-center gap-1">
                  {machine.id && !machine.editando && (
                    <button
                      onClick={() => updateMachine(index, 'editando', true)}
                      className="p-1.5 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      title="Editar máquina"
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => removeMachine(index)}
                    className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Eliminar máquina"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Row body */}
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                  {/* IP */}
                  <div>
                    <label className="block text-xs text-oratioo-gray mb-1 font-medium">IP</label>
                    {machine.id && !machine.editando ? (
                      <div className="flex items-center h-[38px] px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-oratioo-dark select-all">
                        {machine.ip || '—'}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={machine.ip}
                        onChange={(e) => updateMachine(index, 'ip', e.target.value)}
                        placeholder="192.168.1.10"
                        className="input-field text-sm font-mono w-full"
                      />
                    )}
                  </div>

                  {/* Workers */}
                  <div>
                    <label className="block text-xs text-oratioo-gray mb-1 font-medium">Workers</label>
                    {machine.id && !machine.editando ? (
                      <div className="flex items-center h-[38px] px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-oratioo-dark justify-center">
                        {machine.workers}
                      </div>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={machine.workers}
                        onChange={(e) => updateMachine(index, 'workers', Math.max(0, parseInt(e.target.value) || 0))}
                        className="input-field text-sm text-center w-full"
                      />
                    )}
                  </div>

                  {/* Save / Guardado */}
                  <div className="flex items-end">
                    {machine.id && !machine.editando ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 w-full justify-center">
                        <CheckCircle2 size={14} /> Guardado
                      </span>
                    ) : (
                      <button
                        onClick={async () => {
                          if (!machine.nombre) return
                          setSaving(true)
                          try {
                            const payload = {
                              nombre: machine.nombre,
                              ip: machine.ip || '',
                              workers_config: parseInt(machine.workers) || 1,
                            }
                            if (machine.id) {
                              // UPDATE existente
                              await supabase.from('maquinas').update(payload).eq('id', machine.id)
                              setMachines(prev => prev.map((m, i) => i === index ? { ...m, editando: false } : m))
                            } else {
                              // INSERT nuevo
                              const { data } = await supabase.from('maquinas').insert(payload).select()
                              if (data) {
                                setMachines(prev => prev.map((m, i) => i === index ? { ...m, id: data[0].id, editando: false } : m))
                              }
                            }
                          } catch (err) {
                            console.error('Error guardando máquina:', err)
                          } finally {
                            setSaving(false)
                          }
                        }}
                        disabled={saving || !machine.nombre}
                        className="bg-[#0a6ea9] hover:bg-[#085d8f] text-white flex items-center gap-1 text-xs px-4 py-2 rounded-lg transition-all disabled:opacity-40 w-full justify-center"
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? 'Guardando...' : 'Guardar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add PC button */}
      <button
        onClick={addMachine}
        className="w-full py-3 border-2 border-dashed border-oratioo-border rounded-xl text-sm text-oratioo-gray hover:text-oratioo-purple hover:border-oratioo-purple/40 hover:bg-oratioo-light/30 transition-all flex items-center justify-center gap-2"
      >
        <Plus size={16} />
        Agregar PC
      </button>

      {/* Stats bar */}
      <div className="card bg-oratioo-light/40">
        <div className="flex flex-wrap items-center justify-center gap-8">
          <div className="text-center">
            <p className="text-2xl font-bold text-oratioo-dark">{totalWorkers}</p>
            <p className="text-xs text-oratioo-gray">Workers totales</p>
          </div>
          <div className="w-px h-10 bg-oratioo-border" />
          <div className="text-center">
            <p className="text-2xl font-bold text-oratioo-dark">{freeProxies}</p>
            <p className="text-xs text-oratioo-gray">Proxies libres</p>
          </div>
          <div className="w-px h-10 bg-oratioo-border" />
          <div className="text-center">
            <p className="text-2xl font-bold text-oratioo-dark">{machines.length}</p>
            <p className="text-xs text-oratioo-gray">Máquinas configuradas</p>
          </div>
        </div>
      </div>



      {/* Proxy list */}
      {proxies.length > 0 && (
        <div className="card !p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-oratioo-dark flex items-center gap-2">
              <Wifi size={14} className="text-oratioo-gray" />
              Proxies registrados ({proxies.length})
            </h3>
            <button onClick={() => setProxiesShowAdd(true)} className="text-xs text-[#1495e0] hover:underline">
              + Añadir
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-oratioo-border">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-oratioo-gray uppercase tracking-wider">IP</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-oratioo-gray uppercase tracking-wider">Puerto</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-oratioo-gray uppercase tracking-wider">Auth</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-oratioo-gray uppercase tracking-wider">Estado</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-oratioo-gray uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody>
                {proxies.slice((proxiesPage - 1) * proxiesPerPage, proxiesPage * proxiesPerPage).map((p) => (
                  <tr key={p.id} className="border-b border-oratioo-border hover:bg-oratioo-light/30">
                    <td className="px-3 py-2 text-xs font-mono text-oratioo-dark">{p.ip}</td>
                    <td className="px-3 py-2 text-xs text-oratioo-dark">{p.puerto}</td>
                    <td className="px-3 py-2 text-xs text-oratioo-gray">{p.maquina ? p.maquina.split(':')[0] : '—'}</td>
                    <td className="px-3 py-2">
                      {p.estado === 'libre' ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Libre</span>
                      ) : p.estado === 'activo' ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">Activo</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">Caído</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={async () => {
                          if (confirm('¿Eliminar proxy ' + p.ip + ':' + p.puerto + '?')) {
                            await supabase.from('proxies').delete().eq('id', p.id)
                            await loadData()
                          }
                        }}
                        className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {proxies.length > proxiesPerPage && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-oratioo-border">
              <span className="text-xs text-oratioo-gray">
                {proxies.length} proxies — Pág. {proxiesPage} de {Math.ceil(proxies.length / proxiesPerPage)}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setProxiesPage(p => Math.max(1, p - 1))} disabled={proxiesPage === 1}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-oratioo-border bg-white text-oratioo-dark hover:bg-oratioo-light/30 disabled:opacity-30 disabled:cursor-not-allowed">
                  Anterior
                </button>
                <span className="px-2 py-1 text-xs text-oratioo-dark">{proxiesPage}</span>
                <button onClick={() => setProxiesPage(p => Math.min(Math.ceil(proxies.length / proxiesPerPage), p + 1))}
                  disabled={proxiesPage >= Math.ceil(proxies.length / proxiesPerPage)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-oratioo-border bg-white text-oratioo-dark hover:bg-oratioo-light/30 disabled:opacity-30 disabled:cursor-not-allowed">
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Proxy Modal */}
      {proxiesShowAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setProxiesShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#1a1030]">Añadir proxies</h2>
              <button onClick={() => setProxiesShowAdd(false)} className="p-1 rounded hover:bg-[#f5ebf3]"><X size={18} /></button>
            </div>

            {/* Individual */}
            <p className="text-xs font-semibold text-[#7c757c] uppercase tracking-wider mb-3">Individual</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-[#7c757c] mb-1">IP</label>
                <input type="text" value={proxiesNewIp} onChange={e => setProxiesNewIp(e.target.value)}
                  placeholder="ej: 92.113.242.44"
                  className="w-full bg-white border border-[#e8dce6] rounded-lg px-3 py-2 text-sm text-[#1a1030] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0a6ea9]/20"
                />
              </div>
              <div>
                <label className="block text-xs text-[#7c757c] mb-1">Puerto</label>
                <input type="number" value={proxiesNewPuerto} onChange={e => setProxiesNewPuerto(e.target.value)}
                  className="w-full bg-white border border-[#e8dce6] rounded-lg px-3 py-2 text-sm text-[#1a1030] focus:outline-none focus:ring-2 focus:ring-[#0a6ea9]/20"
                />
              </div>
              <div>
                <label className="block text-xs text-[#7c757c] mb-1">Usuario</label>
                <input type="text" value={proxiesNewUser} onChange={e => setProxiesNewUser(e.target.value)}
                  placeholder="webshare user"
                  className="w-full bg-white border border-[#e8dce6] rounded-lg px-3 py-2 text-sm text-[#1a1030] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0a6ea9]/20"
                />
              </div>
              <div>
                <label className="block text-xs text-[#7c757c] mb-1">Contraseña</label>
                <input type="text" value={proxiesNewPass} onChange={e => setProxiesNewPass(e.target.value)}
                  placeholder="webshare pass"
                  className="w-full bg-white border border-[#e8dce6] rounded-lg px-3 py-2 text-sm text-[#1a1030] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0a6ea9]/20"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-[#e8dce6]" />
              <span className="text-xs text-[#7c757c]">o importar varios</span>
              <div className="flex-1 h-px bg-[#e8dce6]" />
            </div>

            {/* Bulk */}
            <p className="text-xs font-semibold text-[#7c757c] uppercase tracking-wider mb-2">Importación masiva</p>
            <textarea
              value={proxiesBulk}
              onChange={e => setProxiesBulk(e.target.value)}
              placeholder="ip:puerto:usuario:contraseña&#10;92.113.242.44:6628:usuario:pass&#10;92.113.83.19:5964:usuario:pass"
              rows={4}
              className="w-full bg-white border border-[#e8dce6] rounded-lg px-3 py-2 text-xs font-mono text-[#1a1030] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0a6ea9]/20 mb-2"
            />
            <label className="flex items-center gap-2 text-xs text-[#1495e0] hover:underline cursor-pointer mb-3">
              <input
                type="file"
                accept=".txt"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = (ev) => {
                      setProxiesBulk(ev.target?.result || '')
                    }
                    reader.readAsText(file)
                  }
                }}
              />
              <Upload size={14} /> Subir archivo .txt
            </label>

            <button onClick={addProxy} disabled={proxiesAdding || (!proxiesNewIp && !proxiesBulk.trim())}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {proxiesAdding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {proxiesAdding ? 'Guardando...' : proxiesBulk.trim() ? `Importar proxies (${proxiesBulk.trim().split('\n').filter(Boolean).length})` : 'Registrar proxy'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
