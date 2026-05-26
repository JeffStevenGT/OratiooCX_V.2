import { useState, useEffect, useMemo } from 'react'
import {
  Calendar, Clock, Phone, CheckCircle2, Loader2, AlertTriangle, RefreshCw, X,
  PhoneOff, XCircle,
} from 'lucide-react'
import { supabase, TABLA_CLIENTES } from '../supabaseClient'

const ESTADOS_RAPIDOS = [
  { value: 'contactado', label: 'Contactado', icon: Phone, color: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' },
  { value: 'interesado', label: 'Interesado', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200' },
  { value: 'en_negociacion', label: 'Negociación', icon: Clock, color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' },
  { value: 'cerrado', label: 'Venta', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200' },
  { value: 'no_interesa', label: 'No Interesa', icon: XCircle, color: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' },
  { value: 'pendiente', label: 'No Contesta', icon: PhoneOff, color: 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200' },
]

export default function Agenda() {
  const session = JSON.parse(localStorage.getItem('oratioo_session') || '{}')
  const myId = session.id
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  const fetchLeads = async () => {
    setLoading(true)
    const { data } = await supabase.from(TABLA_CLIENTES)
      .select('*').order('created_at', { ascending: false }).limit(200)

    if (data) {
      let misLeads = data.filter(c => {
        const ad = c.atributos_dinamicos || {}
        return ad.estado === 'completado' && ad.pipeline?.callback_at
      })

      if (session.rol === 'supervisor') {
        const { data: ases } = await supabase.from('usuarios')
          .select('id').eq('supervisor_id', myId).eq('activo', true)
        const ids = new Set((ases || []).map(a => a.id))
        misLeads = misLeads.filter(c => ids.has(Number(c.atributos_dinamicos?.pipeline?.asesor_id)))
      } else {
        misLeads = misLeads.filter(c => Number(c.atributos_dinamicos?.pipeline?.asesor_id) === Number(myId))
      }
      setLeads(misLeads)
    }
    setLoading(false)
  }

  useEffect(() => { fetchLeads() }, [])

  const ordenados = useMemo(() => {
    return [...leads].sort((a, b) => {
      const ca = new Date(a.atributos_dinamicos?.pipeline?.callback_at || 0)
      const cb = new Date(b.atributos_dinamicos?.pipeline?.callback_at || 0)
      return ca - cb
    })
  }, [leads])

  const vencidos = ordenados.filter(l => new Date(l.atributos_dinamicos?.pipeline?.callback_at) < new Date())
  const proximos = ordenados.filter(l => {
    const e = l.atributos_dinamicos?.pipeline?.estado
    if (e === 'cerrado' || e === 'no_interesa') return false
    return new Date(l.atributos_dinamicos?.pipeline?.callback_at) >= new Date()
  })

  const cambiarEstado = async (lead, nuevoEstado) => {
    setSaving(lead.dni + nuevoEstado)
    const ad = lead.atributos_dinamicos || {}
    const pipe = ad.pipeline || {}
    const newAd = {
      ...ad,
      pipeline: {
        ...pipe,
        estado: nuevoEstado,
        callback_at: nuevoEstado === 'cerrado' || nuevoEstado === 'no_interesa' ? null : pipe.callback_at,
        ultimo_cambio: new Date().toISOString(),
      },
    }
    const { error } = await supabase.from('lineas').update({ atributos_dinamicos: newAd }).eq('dni', lead.dni)
    if (!error) {
      if (nuevoEstado === 'cerrado' || nuevoEstado === 'no_interesa') {
        // Venta o No Interesa: eliminar de la agenda
        setLeads(prev => prev.filter(l => l.dni !== lead.dni))
      } else {
        // No Contesta, Contactado, etc: actualizar y mantener en la agenda
        setLeads(prev => prev.map(l => l.dni === lead.dni ? { ...l, atributos_dinamicos: newAd } : l))
      }
    }
    setSaving(null)
  }

  const cancelarCallback = async (lead) => {
    setSaving(lead.dni + 'cancel')
    const ad = lead.atributos_dinamicos || {}
    const pipe = ad.pipeline || {}
    const newAd = { ...ad, pipeline: { ...pipe, callback_at: null } }
    await supabase.from('lineas').update({ atributos_dinamicos: newAd }).eq('dni', lead.dni)
    setLeads(prev => prev.filter(l => l.dni !== lead.dni))
    setSaving(null)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-[#0a6ea9]" /></div>
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a1030] flex items-center gap-2"><Calendar size={22} className="text-oratioo-purple" /> Agenda</h1>
          <p className="text-sm text-[#7c757c] mt-1">
            {vencidos.length} callback{vencidos.length !== 1 ? 's' : ''} vencido{vencidos.length !== 1 ? 's' : ''} · {proximos.length} próximo{proximos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={fetchLeads} className="border border-[#e8dce6] hover:bg-[#f5ebf3] p-2 rounded-lg transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Vencidos */}
      {vencidos.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
            <AlertTriangle size={14} /> Vencidos ({vencidos.length})
          </h3>
          <div className="space-y-2">
            {vencidos.map(l => {
              const ad = l.atributos_dinamicos || {}
              const pipe = ad.pipeline || {}
              const bas = ad.datos_basicos || {}
              const venc = Math.floor((Date.now() - new Date(pipe.callback_at).getTime()) / (1000 * 60))
              return (
                <div key={l.dni} className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1a1030]">{bas.nombre || '—'}</p>
                      <p className="text-xs text-red-600 mt-0.5">Vence hace {venc} min · {new Date(pipe.callback_at).toLocaleString('es')}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 shrink-0">
                      {ESTADOS_RAPIDOS.map(s => (
                        <button key={s.value} onClick={() => cambiarEstado(l, s.value)} disabled={saving?.startsWith(l.dni)}
                          className={`text-[10px] px-2 py-1 rounded-md border font-medium transition-all ${s.color} disabled:opacity-40`}>
                          {s.label}
                        </button>
                      ))}
                      <button onClick={() => cancelarCallback(l)} disabled={saving?.startsWith(l.dni)}
                        className="border border-red-200 hover:bg-red-100 text-red-500 text-[10px] px-2 py-1 rounded-md">
                        <X size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Próximos - agrupados por día */}
      {proximos.length > 0 && (() => {
        // Agrupar por día
        const grupos = {}
        const hoy = new Date()
        const hoyStr = hoy.toDateString()
        const mananaStr = new Date(hoy.getTime() + 86400000).toDateString()
        for (const l of proximos) {
          const d = new Date(l.atributos_dinamicos?.pipeline?.callback_at)
          const key = d.toDateString()
          if (!grupos[key]) grupos[key] = []
          grupos[key].push(l)
        }
        const dias = Object.keys(grupos).sort()
        return dias.map(diaKey => {
          const items = grupos[diaKey]
          const fecha = new Date(diaKey)
          const label = diaKey === hoyStr ? 'Hoy'
            : diaKey === mananaStr ? 'Mañana'
            : fecha.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
          return (
            <div key={diaKey}>
              <h3 className="text-sm font-semibold text-[#1a1030] mb-3 mt-4 first:mt-0 flex items-center gap-2">
                <Calendar size={14} className="text-[#1495e0]" />
                {label} ({items.length})
              </h3>
              <div className="space-y-2">
                {items.map(l => {
                  const ad = l.atributos_dinamicos || {}
                  const pipe = ad.pipeline || {}
                  const bas = ad.datos_basicos || {}
                  const falta = Math.ceil((new Date(pipe.callback_at) - Date.now()) / (1000 * 60 * 60))
                  return (
                    <div key={l.dni} className="bg-white border border-[#e8dce6] rounded-xl p-4 hover:border-[#1495e0] transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1a1030]">{bas.nombre || '—'}</p>
                          <p className="text-xs text-[#7c757c] mt-0.5">
                            {diaKey === hoyStr
                              ? (falta > 0 ? `En ${falta}h` : 'En menos de 1h')
                              : ''} · {new Date(pipe.callback_at).toLocaleString('es')}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1 shrink-0">
                          {ESTADOS_RAPIDOS.map(s => (
                            <button key={s.value} onClick={() => cambiarEstado(l, s.value)} disabled={saving?.startsWith(l.dni)}
                              className={`text-[10px] px-2 py-1 rounded-md border font-medium transition-all ${s.color} disabled:opacity-40`}>
                              {s.label}
                            </button>
                          ))}
                          <button onClick={() => cancelarCallback(l)} disabled={saving?.startsWith(l.dni)}
                            className="border border-[#e8dce6] hover:bg-[#f5ebf3] text-[#7c757c] text-[10px] px-2 py-1 rounded-md">
                            <X size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      })()}

      {vencidos.length === 0 && proximos.length === 0 && (
        <div className="text-center py-16">
          <Calendar size={48} className="text-[#b8b0b8] mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-[#1a1030] mb-1">Sin callbacks agendados</h2>
          <p className="text-sm text-[#7c757c]">En el Power Dialer podés agendar un callback para cada lead.</p>
        </div>
      )}
    </div>
  )
}
