import { useState, useEffect, useMemo } from 'react'
import { Phone, CheckCircle2, XCircle, PhoneOff, Clock, SkipForward, SkipBack, Loader2, Calendar, AlertTriangle, X } from 'lucide-react'
import { supabase, TABLA_CLIENTES } from '../supabaseClient'

const ESTADOS_RAPIDOS = [
  { value: 'contactado', label: 'Contactado', icon: Phone, color: 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200' },
  { value: 'interesado', label: 'Interesado', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200' },
  { value: 'en_negociacion', label: 'Negociación', icon: Clock, color: 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200' },
  { value: 'cerrado', label: 'Venta', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200' },
  { value: 'no_interesa', label: 'No Interesa', icon: XCircle, color: 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200' },
  { value: 'pendiente', label: 'No Contesta', icon: PhoneOff, color: 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200' },
]

const TABS = ['Pendientes', 'Hoy', 'Todos']

function diasSinActividad(pipeline) {
  if (!pipeline?.ultimo_cambio) return 0
  const diff = Date.now() - new Date(pipeline.ultimo_cambio).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function badgeAntiguedad(dias) {
  if (dias === 0) return null
  if (dias <= 2) return <span className="text-[10px] text-emerald-600 font-medium">\u25cf Hoy</span>
  if (dias <= 4) return <span className="text-[10px] text-amber-600 font-medium">\u25cf {dias}d</span>
  return <span className="text-[10px] text-red-600 font-medium">\u25cf {dias}d</span>
}

export default function AsesorDialer() {
  const session = JSON.parse(localStorage.getItem('oratioo_session') || '{}')
  const [leads, setLeads] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nota, setNota] = useState('')
  const [tab, setTab] = useState('Pendientes')
  const [filterAsesor, setFilterAsesor] = useState('')
  const [asesores, setAsesores] = useState([])
  const [showCalendar, setShowCalendar] = useState(false)
  const [callbackDate, setCallbackDate] = useState('')

  const fetchLeads = async () => {
    setLoading(true)
    const myId = session.id
    const myRol = session.rol
    if (!myId) { setLoading(false); return }

    const { data } = await supabase.from(TABLA_CLIENTES)
      .select('*').order('created_at', { ascending: false }).limit(500)

    if (data) {
      let misLeads = data.filter(c => {
        const ad = c.atributos_dinamicos || {}
        return ad.estado === 'completado'
      })

      if (myRol === 'supervisor') {
        const { data: ases } = await supabase.from('usuarios')
          .select('id, nombre, equipo').eq('supervisor_id', myId).eq('activo', true)
        setAsesores(ases || [])
        const ids = new Set((ases || []).map(a => a.id))
        misLeads = misLeads.filter(c => ids.has(Number(c.atributos_dinamicos?.pipeline?.asesor_id)))
      } else {
        // Asesor normal: solo sus leads
        misLeads = misLeads.filter(c =>
          Number(c.atributos_dinamicos?.pipeline?.asesor_id) === Number(myId)
        )
      }
      setLeads(misLeads)
    }
    setLoading(false)
  }

  useEffect(() => { fetchLeads() }, [])

  // ── Filtrar leads según tab activo + asesor ──────────────────
  const filteredLeads = useMemo(() => {
    const hoy = new Date().toDateString()
    return leads.filter(l => {
      const pipe = l.atributos_dinamicos?.pipeline || {}
      // Filtrar por asesor (solo supervisor)
      if (filterAsesor && Number(pipe.asesor_id) !== Number(filterAsesor)) return false
      if (tab === 'Pendientes') {
        if (pipe.estado === 'cerrado' || pipe.estado === 'no_interesa') return false
        return true
      }
      if (tab === 'Hoy') {
        const ultimo = pipe.ultimo_cambio ? new Date(pipe.ultimo_cambio).toDateString() : null
        return ultimo === hoy
      }
      return true // Todos
    })
  }, [leads, tab])

  // Si el índice está fuera del filtro, resetear
  useEffect(() => {
    if (filteredLeads.length > 0 && index >= filteredLeads.length) {
      setIndex(filteredLeads.length - 1)
    }
    setNota('')
  }, [tab])

  const lead = filteredLeads[index]
  const ad = lead?.atributos_dinamicos || {}
  const pipeline = ad.pipeline || {}
  const bas = ad.datos_basicos || {}
  const linea = ad.linea || {}

  // Stats del tab actual
  const stats = useMemo(() => ({
    total: filteredLeads.length,
    pendientes: filteredLeads.filter(l => (l.atributos_dinamicos?.pipeline?.estado || 'pendiente') === 'pendiente').length,
    contactados: filteredLeads.filter(l => l.atributos_dinamicos?.pipeline?.estado === 'contactado').length,
    gestion: filteredLeads.filter(l => ['interesado', 'en_negociacion'].includes(l.atributos_dinamicos?.pipeline?.estado)).length,
    cerrados: filteredLeads.filter(l => ['cerrado', 'no_interesa'].includes(l.atributos_dinamicos?.pipeline?.estado)).length,
  }), [filteredLeads])

  // Leads arrastrados (pendientes con +3 días)
  const arrastrados = useMemo(() =>
    leads.filter(l => {
      const pipe = l.atributos_dinamicos?.pipeline || {}
      if (pipe.estado === 'cerrado' || pipe.estado === 'no_interesa') return false
      return diasSinActividad(pipe) >= 3
    }).length,
  [leads])

  const cambiarEstado = async (nuevoEstado) => {
    if (!lead) return
    setSaving(true)
    const newAd = { ...ad, pipeline: { ...pipeline, estado: nuevoEstado, notas: nota || pipeline.notas || '', ultimo_cambio: new Date().toISOString() } }
    const { error } = await supabase.from('lineas').update({ atributos_dinamicos: newAd }).eq('dni', lead.dni)
    if (error) {
      console.error('Error al cambiar estado:', error.message || error)
    } else {
      const newLeads = [...leads]
      const realIdx = leads.findIndex(l => l.dni === lead.dni)
      if (realIdx !== -1) {
        newLeads[realIdx] = { ...lead, atributos_dinamicos: newAd }
        setLeads(newLeads)
      }
    }
    setSaving(false)
    // Auto-avance si es No Contesta
    if (['pendiente', 'no_interesa'].includes(nuevoEstado) && index < filteredLeads.length - 1) {
      setTimeout(() => { setNota(''); setIndex(i => Math.min(i + 1, filteredLeads.length - 1)) }, 300)
    }
  }

  const goTo = (dir) => {
    setNota('')
    if (dir === 'next' && index < filteredLeads.length - 1) setIndex(index + 1)
    if (dir === 'prev' && index > 0) setIndex(index - 1)
  }

  const antiguedad = diasSinActividad(pipeline)
  const badge = badgeAntiguedad(antiguedad)

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-[#0a6ea9]" /></div>
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <Phone size={48} className="text-[#7c757c] mb-4" />
        <h2 className="text-lg font-semibold text-[#1a1030] mb-2">Sin leads asignados</h2>
        <p className="text-sm text-[#7c757c]">Pedile a tu supervisor que te asigne clientes.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a1030] flex items-center gap-2"><Phone size={22} className="text-oratioo-purple" /> Power Dialer</h1>
          <p className="text-xs text-[#7c757c] mt-1">{leads.length} leads asignados</p>
        </div>
        <div className="flex items-center gap-3 text-center">
          <div><p className="text-[10px] text-[#7c757c]">Pendientes</p><p className="text-sm font-bold text-[#1a1030]">{stats.pendientes}</p></div>
          <div className="w-px h-8 bg-[#e8dce6]" />
          <div><p className="text-[10px] text-[#7c757c]">Gestión</p><p className="text-sm font-bold text-[#1495e0]">{stats.gestion}</p></div>
          <div className="w-px h-8 bg-[#e8dce6]" />
          <div><p className="text-[10px] text-[#7c757c]">Ventas</p><p className="text-sm font-bold text-emerald-600">{stats.cerrados}</p></div>
        </div>
      </div>

      {/* Filtro por asesor (solo supervisor) */}
      {session.rol === 'supervisor' && asesores.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#7c757c]">Asesor:</span>
          <select value={filterAsesor} onChange={e => { setFilterAsesor(e.target.value); setIndex(0) }}
            className="border border-[#e8dce6] rounded-lg px-2 py-1.5 text-xs">
            <option value="">Todos</option>
            {asesores.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </div>
      )}

      {/* Alerta leads arrastrados */}
      {arrastrados > 0 && tab === 'Pendientes' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center gap-2 text-xs text-amber-700">
          <AlertTriangle size={14} />
          {arrastrados} lead{arrastrados !== 1 ? 'es' : ''} sin contactar desde hace +3 días
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#e8dce6]">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium transition-all border-b-2 -mb-px ${
              tab === t
                ? 'border-[#1495e0] text-[#1495e0]'
                : 'border-transparent text-[#7c757c] hover:text-[#1a1030]'
            }`}>
            {t}
            {t === 'Pendientes' && stats.pendientes > 0 && (
              <span className="ml-1.5 rounded-full bg-[#1495e0] text-white text-[10px] px-1.5 py-0.5">{stats.pendientes}</span>
            )}
          </button>
        ))}
      </div>

      {/* Empty state por tab */}
      {filteredLeads.length === 0 ? (
        <div className="text-center py-12">
          <Clock size={32} className="text-[#b8b0b8] mx-auto mb-2" />
          <p className="text-sm text-[#7c757c]">
            {tab === 'Pendientes' ? 'No tenés leads pendientes \u2014 bien ahí!' :
             tab === 'Hoy' ? 'No hubo actividad hoy' : 'No tenés leads asignados'}
          </p>
        </div>
      ) : (
        <>
          {/* Lead Card */}
          {lead && (
            <div className="card max-w-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs ${
                    ad.cima === 'SI' ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-[#1a1030] border border-[#e8dce6]'
                  }`}>
                    {ad.cima === 'SI' ? 'CIMA' : 'NO'}
                  </span>
                  {badge}
                  {pipeline.callback_at && (
                    <span className="rounded-full bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 text-[10px] flex items-center gap-1">
                      <Calendar size={10} /> {new Date(pipeline.callback_at).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#7c757c]">{pipeline.estado || 'pendiente'}</span>
              </div>

              <h2 className="text-lg font-semibold text-[#1a1030] mb-1">{bas.nombre || '—'}</h2>
              <p className="text-sm text-[#7c757c] mb-4">{bas.direccion || '—'}</p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-[#f5ebf3] rounded-lg p-3">
                  <p className="text-[10px] text-[#7c757c]">Línea</p>
                  <p className="text-sm font-mono text-[#1a1030]">{linea.linea_principal || lead.linea || '—'}</p>
                </div>
                <div className="bg-[#f5ebf3] rounded-lg p-3">
                  <p className="text-[10px] text-[#7c757c]">Paquete</p>
                  <p className="text-sm text-[#1a1030]">{linea.paquete || lead.paquete || '—'}</p>
                </div>
                <div className="bg-[#f5ebf3] rounded-lg p-3">
                  <p className="text-[10px] text-[#7c757c]">DNI</p>
                  <p className="text-sm font-mono text-[#1a1030]">{lead.dni}</p>
                </div>
                <div className="bg-[#f5ebf3] rounded-lg p-3">
                  <p className="text-[10px] text-[#7c757c]">Renove</p>
                  <p className="text-sm text-[#0a6ea9] font-medium">{ad.renove_mixto_variante || ad.tipo_renove || '—'}</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {ESTADOS_RAPIDOS.map(s => (
                  <button key={s.value} onClick={() => cambiarEstado(s.value)} disabled={saving}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-xs font-medium border transition-all ${s.color} disabled:opacity-50`}>
                    <s.icon size={13} /> {s.label}
                  </button>
                ))}
              </div>

              {/* Botón agendar callback */}
              <div className="mb-3 flex items-center gap-2">
                <button onClick={() => { setCallbackDate(pipeline.callback_at ? pipeline.callback_at.slice(0, 16) : ''); setShowCalendar(true) }}
                  className="border border-[#e8dce6] hover:bg-[#f5ebf3] text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors">
                  <Calendar size={13} className="text-[#1495e0]" />
                  {pipeline.callback_at ? 'Cambiar' : 'Agendar'}
                </button>
                {pipeline.callback_at && (
                  <>
                    <span className="text-[10px] text-[#7c757c]">
                      {new Date(pipeline.callback_at).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button onClick={async () => {
                      if (!lead) return
                      const newAd = { ...ad, pipeline: { ...pipeline, callback_at: null } }
                      await supabase.from('lineas').update({ atributos_dinamicos: newAd }).eq('dni', lead.dni)
                      const newLeads = [...leads]
                      const ri = leads.findIndex(l => l.dni === lead.dni)
                      if (ri !== -1) newLeads[ri] = { ...lead, atributos_dinamicos: newAd }
                      setLeads(newLeads)
                    }} className="text-red-400 hover:text-red-600 transition-colors" title="Cancelar callback">
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>

              {/* Modal agendar */}
              {showCalendar && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCalendar(false)}>
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                    <h3 className="text-sm font-semibold text-[#1a1030] mb-1">Agendar callback</h3>
                    <p className="text-xs text-[#7c757c] mb-4">{bas.nombre || '—'}</p>
                    <input type="datetime-local" value={callbackDate}
                      onChange={e => setCallbackDate(e.target.value)}
                      className="w-full border border-[#e8dce6] rounded-lg px-3 py-2.5 text-sm mb-4" />
                    <div className="flex gap-3">
                      <button onClick={() => setShowCalendar(false)}
                        className="flex-1 border border-[#e8dce6] hover:bg-[#f5ebf3] py-2 rounded-lg text-sm transition-colors">
                        Cancelar
                      </button>
                      <button onClick={async () => {
                        if (!callbackDate || !lead) return
                        const newAd = { ...ad, pipeline: { ...pipeline, callback_at: new Date(callbackDate).toISOString() } }
                        const { error } = await supabase.from('lineas').update({ atributos_dinamicos: newAd }).eq('dni', lead.dni)
                        if (error) { console.error('Error al guardar callback:', error); return }
                        const newLeads = [...leads]
                        const ri = leads.findIndex(l => l.dni === lead.dni)
                        if (ri !== -1) newLeads[ri] = { ...lead, atributos_dinamicos: newAd }
                        setLeads(newLeads)
                        setShowCalendar(false)
                      }} disabled={!callbackDate}
                        className="flex-1 bg-[#1495e0] hover:bg-[#0f7cc0] text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40">
                        Guardar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Notas */}
              <div className="mb-3">
                <textarea value={nota} onChange={e => setNota(e.target.value)}
                  placeholder={pipeline.notas ? 'Nota anterior: ' + pipeline.notas : 'Notas de la llamada...'}
                  rows={2} className="w-full border border-[#e8dce6] rounded-lg px-3 py-2 text-sm resize-none" />
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button onClick={() => goTo('prev')} disabled={index === 0}
                  className="bg-white border border-[#e8dce6] hover:bg-[#f5ebf3] px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-30 transition-all">
                  <SkipBack size={13} /> Anterior
                </button>
                <span className="text-xs text-[#7c757c]">{index + 1} / {filteredLeads.length}</span>
                <button onClick={() => goTo('next')} disabled={index >= filteredLeads.length - 1}
                  className="bg-[#0a6ea9] hover:bg-[#085d8f] text-white px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-30 transition-all">
                  Siguiente <SkipForward size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Lead list compacta */}
          <div className="card !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e8dce6]">
                    <th className="table-header px-3 py-2 text-[10px]">#</th>
                    <th className="table-header px-3 py-2 text-[10px]">Nombre</th>
                    <th className="table-header px-3 py-2 text-[10px]">CIMA</th>
                    <th className="table-header px-3 py-2 text-[10px]">Renove</th>
                    <th className="table-header px-3 py-2 text-[10px]">Estado</th>
                    <th className="table-header px-3 py-2 text-[10px]">Días</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((l, i) => {
                    const a = l.atributos_dinamicos || {}
                    const p = a.pipeline || {}
                    const dias = diasSinActividad(p)
                    return (
                      <tr key={l.dni + i} onClick={() => { setIndex(i); setNota('') }}
                        className={`border-b border-[#e8dce6] cursor-pointer transition-colors text-xs ${
                          i === index ? 'bg-[#e6f3fb]' : 'hover:bg-[#f5ebf3]/50'
                        }`}>
                        <td className="px-3 py-2 text-[#7c757c]">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{a.datos_basicos?.nombre || '—'}</td>
                        <td className="px-3 py-2">{a.cima === 'SI' ? 'CIMA' : '—'}</td>
                        <td className="px-3 py-2 text-[10px] text-[#0a6ea9]">{a.renove_mixto_variante && a.renove_mixto_variante !== 'N/A' ? a.renove_mixto_variante.slice(0, 20) + '...' : '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                              p.estado === 'pendiente' ? 'bg-gray-100 text-gray-600' :
                              p.estado === 'cerrado' ? 'bg-emerald-100 text-emerald-700' :
                              p.estado === 'no_interesa' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>{p.estado || 'pendiente'}</span>
                            {p.callback_at && <span className="text-[10px] text-[#1495e0]" title={new Date(p.callback_at).toLocaleString('es')}>⏰</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {dias === 0 ? <span className="text-emerald-600 text-[10px]">Hoy</span> :
                           dias <= 2 ? <span className="text-emerald-600 text-[10px]">{dias}d</span> :
                           dias <= 4 ? <span className="text-amber-600 text-[10px]">{dias}d</span> :
                           <span className="text-red-600 text-[10px] font-medium">{dias}d</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}




