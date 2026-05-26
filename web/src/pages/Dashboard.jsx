import { useState, useEffect, Fragment } from 'react'
import {
  Users,
  UserCheck,
  RefreshCw,
  TrendingUp,
  Loader2,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { supabase, TABLA_CLIENTES } from '../supabaseClient'
import StatCard from '../components/StatCard'

// ── Colores por estado del pipeline ─────────────────────────
const PIPELINE_COLORS = {
  pendiente: 'bg-gray-100 text-gray-700',
  contactado: 'bg-amber-100 text-amber-700',
  interesado: 'bg-blue-100 text-blue-700',
  en_negociacion: 'bg-indigo-100 text-indigo-700',
  cerrado: 'bg-emerald-100 text-emerald-700',
  no_interesa: 'bg-red-100 text-red-700',
}

const PIPELINE_LABELS = {
  pendiente: 'Pendiente',
  contactado: 'Contactado',
  interesado: 'Interesado',
  en_negociacion: 'En Negociación',
  cerrado: 'Venta',
  no_interesa: 'No Interesa',
}

const PIPELINE_ICONS = {
  pendiente: Clock,
  contactado: Phone,
  interesado: UserCheck,
  en_negociacion: TrendingUp,
  cerrado: CheckCircle2,
  no_interesa: XCircle,
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, cima: 0, renoveMixto: 0, cimaRenove: 0, tasaExtraccion: 0, tasaConversion: 0, asignados: 0, pendientes: 0, contactados: 0, cerrados: 0 })
  const [chartData, setChartData] = useState([])
  const [equipoStats, setEquipoStats] = useState([])
  const [staleLeads, setStaleLeads] = useState({ tres: 0, siete: 0, quince: 0 })
  const [expandidoSup, setExpandidoSup] = useState(null)
  const [contactadosHoy, setContactadosHoy] = useState(0)
  const [arrastrados, setArrastrados] = useState(0)
  const [agendados, setAgendados] = useState(0)
  const [clientesHoy, setClientesHoy] = useState([])
  const [periodo, setPeriodo] = useState('all')

  function getDateFilter(periodo) {
    const now = new Date()
    if (periodo === 'hoy') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      return start
    }
    if (periodo === 'semana') {
      const start = new Date(now)
      start.setDate(start.getDate() - 7)
      return start
    }
    if (periodo === 'mes') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return start
    }
    if (periodo === 'trimestre') {
      const start = new Date(now)
      start.setMonth(start.getMonth() - 3)
      return start
    }
    if (periodo === '6m') {
      const start = new Date(now)
      start.setMonth(start.getMonth() - 6)
      return start
    }
    return null
  }

  const fetchData = async (periodoActual) => {
    const periodoUsar = periodoActual || periodo
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from(TABLA_CLIENTES)
        .select('dni, created_at, atributos_dinamicos')

      if (error) throw error

      let clientes = (data || []).filter(c => c.atributos_dinamicos?.estado === 'completado')

      // ── Filtrar por rol del usuario ───────────────────────
      const sesionLocal = JSON.parse(localStorage.getItem('oratioo_session') || '{}')
      const currentRol = sesionLocal.rol || 'jefe_area'
      const currentId = sesionLocal.id

      if (currentRol === 'asesor') {
        clientes = clientes.filter(c =>
          Number(c.atributos_dinamicos?.pipeline?.asesor_id) === Number(currentId)
        )
      } else if (currentRol === 'supervisor') {
        const { data: teamMembers } = await supabase
          .from('usuarios')
          .select('id')
          .eq('supervisor_id', currentId)
        const teamIds = (teamMembers || []).map(t => Number(t.id))
        clientes = clientes.filter(c =>
          teamIds.includes(Number(c.atributos_dinamicos?.pipeline?.asesor_id))
        )
      }

      // ── Filtrar por período ───────────────────────────────
      const fechaCorte = getDateFilter(periodoUsar)
      if (fechaCorte) {
        clientes = clientes.filter(c => {
          const f = c.atributos_dinamicos?.pipeline?.ultimo_cambio || c.created_at
          return f && new Date(f) >= fechaCorte
        })
      }

      // ── Datos de supervisores y equipos ───────────────────
      const { data: supervisores } = await supabase
        .from('usuarios')
        .select('id, nombre')
        .eq('rol', 'supervisor')
        .eq('activo', true)

      const supList = supervisores || []

      if (supList.length > 0) {
        const supWithCounts = await Promise.all(supList.map(async (sup) => {
          const { data: ases } = await supabase
            .from('usuarios')
            .select('id, nombre')
            .eq('supervisor_id', sup.id)
            .eq('activo', true)
          const asesIds = (ases || []).map(a => a.id)
          const leadsEquipo = clientes.filter(c =>
            asesIds.includes(Number(c.atributos_dinamicos?.pipeline?.asesor_id))
          )
          const ventas = leadsEquipo.filter(c => c.atributos_dinamicos?.pipeline?.estado === 'cerrado').length
          const hoyStr = new Date().toISOString().split('T')[0]
          const hoy = leadsEquipo.filter(c => {
            const uc = c.atributos_dinamicos?.pipeline?.ultimo_cambio || ''
            return uc.startsWith(hoyStr) && c.atributos_dinamicos?.pipeline?.estado === 'cerrado'
          }).length
          // Per-asesor stats
          const asesStats = (ases || []).map(a => {
            const l = leadsEquipo.filter(c => Number(c.atributos_dinamicos?.pipeline?.asesor_id) === Number(a.id))
            const ventas = l.filter(c => c.atributos_dinamicos?.pipeline?.estado === 'cerrado').length
            const hoy = l.filter(c => {
              const uc = c.atributos_dinamicos?.pipeline?.ultimo_cambio || ''
              return uc.startsWith(hoyStr) && c.atributos_dinamicos?.pipeline?.estado === 'cerrado'
            }).length
            return { id: a.id, nombre: a.nombre, leads: l.length, ventas, hoy }
          })
          return { ...sup, leads: leadsEquipo.length, ventas, hoy, asesores: asesIds.length, asesStats }
        }))
        setEquipoStats(supWithCounts)
      }

      const total = clientes.length
      const cima = clientes.filter((c) => c.atributos_dinamicos?.cima === 'SI').length
      const renoveMixto = clientes.filter((c) => c.atributos_dinamicos?.tiene_renove_mixto).length
      const cimaRenove = clientes.filter((c) => c.atributos_dinamicos?.cima === 'SI' && c.atributos_dinamicos?.tiene_renove_mixto).length
      const tasaExtraccion = total > 0 ? Math.round((cimaRenove / total) * 100) : 0

      // Pipeline counts
      const pendientes = clientes.filter(c => (c.atributos_dinamicos?.pipeline?.estado || 'pendiente') === 'pendiente').length
      const contactados = clientes.filter(c => ['contactado', 'interesado', 'en_negociacion'].includes(c.atributos_dinamicos?.pipeline?.estado)).length
      const cerrados = clientes.filter(c => ['cerrado', 'no_interesa'].includes(c.atributos_dinamicos?.pipeline?.estado)).length
      const asignados = clientes.filter(c => c.atributos_dinamicos?.pipeline?.asesor_id).length
      const tasaConversion = total > 0 ? Math.round((cerrados / Math.max(asignados, 1)) * 100) : 0

      setStats({ total, cima, renoveMixto, cimaRenove, tasaExtraccion, tasaConversion, asignados, pendientes, contactados, cerrados })

      // ── Leads durmiendo (asignados sin actividad) ──────────
      const ahora = new Date()
      let cont3 = 0, cont7 = 0, cont15 = 0
      for (const c of clientes) {
        const pipe = c.atributos_dinamicos?.pipeline || {}
        if (!pipe.asesor_id) continue
        if (pipe.estado === 'cerrado' || pipe.estado === 'no_interesa') continue
        const ultimo = pipe.ultimo_cambio
          ? new Date(pipe.ultimo_cambio)
          : (c.updated_at ? new Date(c.updated_at) : new Date(c.created_at))
        const dias = Math.floor((ahora - ultimo) / (1000 * 60 * 60 * 24))
        if (dias >= 15) cont15++
        else if (dias >= 7) cont7++
        else if (dias >= 3) cont3++
      }
      setStaleLeads({ tres: cont3, siete: cont7, quince: cont15 })

      // ── Contactados hoy ────────────────────────────────────
      const hoyStr = new Date().toISOString().split('T')[0]
      const contHoy = clientes.filter(c => {
        const uc = c.atributos_dinamicos?.pipeline?.ultimo_cambio || ''
        return uc.startsWith(hoyStr) && c.atributos_dinamicos?.pipeline?.estado !== 'pendiente'
      }).length
      setContactadosHoy(contHoy)

      const arrast = clientes.filter(c => {
        const pipe = c.atributos_dinamicos?.pipeline || {}
        if (!pipe.asesor_id || pipe.estado === 'cerrado' || pipe.estado === 'no_interesa') return false
        const ultimo = pipe.ultimo_cambio ? new Date(pipe.ultimo_cambio) : new Date(c.created_at)
        return (Date.now() - ultimo.getTime()) / (1000*60*60*24) >= 3
      }).length
      setArrastrados(arrast)

      // ── Agendados (con callback pendiente) ────────────
      const agend = clientes.filter(c => {
        const p = c.atributos_dinamicos?.pipeline || {}
        return p.asesor_id && p.callback_at && p.estado !== 'cerrado' && p.estado !== 'no_interesa'
      }).length
      setAgendados(agend)

      // ── Actividad de hoy ───────────────────────────────────
      const hoyAct = clientes
        .filter(c => {
          const uc = c.atributos_dinamicos?.pipeline?.ultimo_cambio || ''
          return uc.startsWith(hoyStr) && c.atributos_dinamicos?.pipeline?.estado !== 'pendiente'
        })
        .sort((a, b) => {
          const ta = a.atributos_dinamicos?.pipeline?.ultimo_cambio || ''
          const tb = b.atributos_dinamicos?.pipeline?.ultimo_cambio || ''
          return tb.localeCompare(ta)
        })
      setClientesHoy(hoyAct)

      // Chart: últimos 7 días
      const last7 = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        const dayLabel = d.toLocaleDateString('es', { weekday: 'short', day: 'numeric' })
        const count = clientes.filter((c) => {
          if (!c.created_at) return false
          const cDate = c.created_at.split('T')[0]
          return cDate === dateStr
        }).length
        last7.push({ day: dayLabel, Procesados: count })
      }
      setChartData(last7)
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [periodo])

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-oratioo-border rounded-lg px-3 py-2 text-xs shadow-lg">
          <p className="text-oratioo-gray">{label}</p>
          <p className="text-oratioo-purple font-semibold">{payload[0].value} DNIs</p>
        </div>
      )
    }
    return null
  }

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-oratioo-dark flex items-center gap-2">
            Dashboard
          </h1>
          <p className="text-sm text-oratioo-gray mt-1">
            Resumen general de datos procesados
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtros de período */}
          {['hoy', 'semana', 'mes', 'trimestre', '6m', 'all'].map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                periodo === p
                  ? 'bg-[#1495e0] text-white'
                  : 'border border-[#e8dce6] text-[#7c757c] hover:bg-[#f5ebf3]'
              }`}>
              {p === 'hoy' ? 'Hoy' : p === 'semana' ? '7 días' : p === 'mes' ? 'Mes' : p === 'trimestre' ? 'Trim' : p === '6m' ? '6M' : 'Todo'}
            </button>
          ))}
          <button onClick={() => fetchData(periodo)} className="border border-[#e8dce6] hover:bg-[#f5ebf3] p-2 rounded-lg transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Datos extraídos por el bot */}
      <div className="flex items-center gap-2 mb-1">
        <div className="h-3 w-3 rounded-full bg-[#0a6ea9]"></div>
        <span className="text-[10px] text-[#7c757c] uppercase tracking-wider font-semibold">Datos del Bot</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Leads"
          value={stats.total.toLocaleString()}
          subtitle="Leads procesados"
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Clientes CIMA"
          value={stats.cima.toLocaleString()}
          subtitle={`${stats.total > 0 ? Math.round((stats.cima / stats.total) * 100) : 0}% del total`}
          icon={UserCheck}
          color="violet"
        />
        <StatCard
          title="CIMA + Renove"
          value={stats.cimaRenove.toLocaleString()}
          subtitle={`${stats.tasaExtraccion}% de extracción`}
          icon={RefreshCw}
          color="emerald"
        />
          <StatCard
            title="Tasa Extracción"
            value={`${stats.tasaExtraccion}%`}
            subtitle={`${stats.cimaRenove} CIMA+Renove de ${stats.total} leads`}
            icon={TrendingUp}
            color="amber"
          />
      </div>

      {/* Monitoreo */}
      <div className="flex items-center gap-2 mb-1 mt-2">
        <div className="h-3 w-3 rounded-full bg-amber-500"></div>
        <span className="text-[10px] text-[#7c757c] uppercase tracking-wider font-semibold">Monitoreo</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Leads durmiendo */}
        <div className="card !p-4">
          <h3 className="text-xs font-semibold text-[#7c757c] uppercase tracking-wider mb-3">Leads durmiendo</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
              <span className="text-xs text-amber-700">+3 días</span>
              <span className="text-sm font-bold text-amber-600">{staleLeads.tres}</span>
            </div>
            <div className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-2 border border-orange-200">
              <span className="text-xs text-orange-700">+7 días</span>
              <span className="text-sm font-bold text-orange-600">{staleLeads.siete}</span>
            </div>
            <div className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2 border border-red-200">
              <span className="text-xs text-red-700">+15 días</span>
              <span className="text-sm font-bold text-red-600">{staleLeads.quince}</span>
            </div>
          </div>
        </div>

        {/* Chart mini al costado */}
        <div className="card !p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[#7c757c] uppercase tracking-wider">Procesados por día</h3>
            <span className="text-[10px] text-[#7c757c]">Últimos 7 días</span>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e8dce6" />
                <XAxis dataKey="day" tick={{ fill: '#7c757c', fontSize: 10 }} axisLine={{ stroke: '#e8dce6' }} tickLine={false} />
                <YAxis tick={{ fill: '#7c757c', fontSize: 10 }} axisLine={{ stroke: '#e8dce6' }} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(72,17,100,0.06)' }} />
                <Bar dataKey="Procesados" fill="#0a6ea9" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Gestión comercial */}
      <div className="flex items-center gap-2 mb-1 mt-2">
        <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
        <span className="text-[10px] text-[#7c757c] uppercase tracking-wider font-semibold">Gestión Comercial</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-[#e8dce6] rounded-xl p-4">
          <p className="text-[10px] text-[#7c757c] uppercase tracking-wider">Pendientes</p>
          <p className="text-xl font-bold text-[#1a1030] mt-1">{stats.pendientes}</p>
          <p className="text-[10px] text-[#7c757c] mt-0.5">Sin contactar</p>
        </div>
        <div className="bg-white border border-[#e8dce6] rounded-xl p-4">
          <p className="text-[10px] text-[#7c757c] uppercase tracking-wider">En Gestión</p>
          <p className="text-xl font-bold text-[#1495e0] mt-1">{stats.contactados}</p>
          <p className="text-[10px] text-[#7c757c] mt-0.5">Contactados / Interesados</p>
        </div>
        <div className="bg-white border border-[#e8dce6] rounded-xl p-4">
          <p className="text-[10px] text-[#7c757c] uppercase tracking-wider">Ventas</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{stats.cerrados}</p>
          <p className="text-[10px] text-[#7c757c] mt-0.5">{stats.tasaConversion}% de cierre</p>
        </div>
        <div className="bg-white border border-[#e8dce6] rounded-xl p-4">
          <p className="text-[10px] text-[#7c757c] uppercase tracking-wider">Efectividad</p>
          <p className="text-xl font-bold text-[#1495e0] mt-1">{stats.asignados > 0 ? Math.round((stats.cerrados / stats.asignados) * 100) : 0}%</p>
          <p className="text-[10px] text-[#7c757c] mt-0.5">{stats.cerrados} ventas de {stats.asignados} asignados</p>
        </div>
      </div>

      {/* Equipo */}
      <div className="flex items-center gap-2 mb-1 mt-2">
        <div className="h-3 w-3 rounded-full bg-[#481163]"></div>
        <span className="text-[10px] text-[#7c757c] uppercase tracking-wider font-semibold">Equipos</span>
      </div>
      {equipoStats.length > 0 && (
        <div className="card !p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[#7c757c] uppercase tracking-wider">
              Supervisores
            </h3>
            <span className="text-[10px] text-[#7c757c]">{equipoStats.reduce((s, a) => s + a.leads, 0)} leads total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#e8dce6]">
                  <th className="text-left py-2 text-[10px] text-[#7c757c] font-medium">Nombre</th>
                  <th className="text-right py-2 text-[10px] text-[#7c757c] font-medium">Leads</th>
                  <th className="text-right py-2 text-[10px] text-[#7c757c] font-medium">Ventas</th>
                  <th className="text-right py-2 text-[10px] text-[#7c757c] font-medium">V.Hoy</th>
                  <th className="text-right py-2 text-[10px] text-[#7c757c] font-medium">Asesores</th>
                </tr>
              </thead>
              <tbody>
                {equipoStats.map(a => {
                  const exp = expandidoSup === a.id
                  return (
                    <Fragment key={a.id}>
                      <tr
                        onClick={() => setExpandidoSup(exp ? null : a.id)}
                        className={`border-b border-[#f0ecf0] last:border-0 cursor-pointer hover:bg-[#f5ebf3]/30 transition-colors ${exp ? 'bg-[#f5ebf3]/50' : ''}`}>
                        <td className="py-2 font-medium text-[#1a1030]">{a.nombre}</td>
                        <td className="py-2 text-right font-bold text-[#0a6ea9]">{a.leads}</td>
                        <td className="py-2 text-right text-emerald-600">{a.ventas || '—'}</td>
                        <td className="py-2 text-right text-[#1495e0]">{a.hoy || '—'}</td>
                        <td className="py-2 text-right text-[#7c757c]">{a.asesores || '—'}</td>
                      </tr>
                      {exp && a.asesStats && a.asesStats.length > 0 && (
                        <tr key={a.id + '-det'}>
                          <td colSpan={5} className="p-0">
                            <div className="bg-[#faf8fc] px-4 py-2 border-b border-[#e8dce6]">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-[#f0ecf0]">
                                    <th className="text-left py-1.5 text-[10px] text-[#7c757c] font-medium pl-4">Asesor</th>
                                    <th className="text-right py-1.5 text-[10px] text-[#7c757c] font-medium">Leads</th>
                                    <th className="text-right py-1.5 text-[10px] text-[#7c757c] font-medium">Ventas</th>
                                    <th className="text-right py-1.5 text-[10px] text-[#7c757c] font-medium pr-4">Hoy</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {a.asesStats.map(ase => (
                                    <tr key={ase.id} className="border-b border-[#f0ecf0] last:border-0">
                                      <td className="py-1.5 text-[#1a1030] pl-4">{ase.nombre}</td>
                                      <td className="py-1.5 text-right text-[#0a6ea9]">{ase.leads}</td>
                                      <td className="py-1.5 text-right text-emerald-600">{ase.ventas}</td>
                                      <td className="py-1.5 text-right text-[#1495e0] pr-4">{ase.hoy || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leads arrastrados */}
      {arrastrados > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">{arrastrados} lead{arrastrados !== 1 ? 'es' : ''} sin actividad</p>
            <p className="text-xs text-amber-700 mt-1">Llevan +3 días sin contacto. Priorizalos en el Power Dialer.</p>
          </div>
        </div>
      )}

      {/* Actividad de hoy */}
      {contactadosHoy > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-[#1a1030] mb-3 flex items-center gap-2">
            <Phone size={14} className="text-[#1495e0]" />
            Actividad de hoy
          </h3>
          <div className="space-y-2">
            {clientesHoy.slice(0, 10).map(c => {
              const ad = c.atributos_dinamicos || {}
              const pipe = ad.pipeline || {}
              const bas = ad.datos_basicos || {}
              const hora = pipe.ultimo_cambio
                ? new Date(pipe.ultimo_cambio).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
                : ''
              const colorEstado = {
                contactado: 'bg-amber-100 text-amber-700',
                interesado: 'bg-emerald-100 text-emerald-700',
                en_negociacion: 'bg-blue-100 text-blue-700',
                cerrado: 'bg-emerald-100 text-emerald-700',
                no_interesa: 'bg-red-100 text-red-700',
              }[pipe.estado] || 'bg-gray-100 text-gray-700'
              return (
                <div key={c.dni} className="flex items-center gap-3 py-1.5 border-b border-[#f0ecf0] last:border-0">
                  <span className="text-[10px] text-[#7c757c] w-10 shrink-0">{hora}</span>
                  <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${colorEstado}`}>
                    {pipe.estado || 'pendiente'}
                  </span>
                  <span className="text-xs text-[#1a1030]">{bas.nombre || '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}


    </div>
  )
}
