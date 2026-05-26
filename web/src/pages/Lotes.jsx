import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Package, Plus, X, Search, Upload, Download, ChevronDown, ChevronRight,
  Users, UserCheck, Clock, Loader2, RefreshCw, Save, Trash2,
} from 'lucide-react'
import { supabase } from '../supabaseClient'

// ── Tabla Supabase y claves localStorage ──────────────────────
const TABLA_USUARIOS = 'usuarios'
const LOTES_KEY = 'oratioo_lotes'
const LOTES_DNIS_KEY = 'oratioo_lote_dnis'
const USUARIOS_KEY = 'oratioo_usuarios'

// ── Cache de usuarios desde Supabase (módulo) ─────────────────
let _usuariosCache = []

// ── Helper IDs ────────────────────────────────────────────────
function nextId(arr) {
  return (arr.reduce((m, i) => Math.max(m, i.id || 0), 0) + 1)
}

// ── Datos semilla ─────────────────────────────────────────────
// Supervisor IDs actualizados: Ricardo Gutiérrez (25), Valeria Paredes (32), Javier Moreno (39), Carmen Vega (46)
// creado_por: Daniela Paz (22)
const LOTES_SEMILLA = [
  { id: 1, nombre: 'Campaña Mayo - Clientes Premium', supervisor_id: 25, creado_por: 22, total_dnis: 8, asignados: 3, created_at: '2026-05-02T10:00:00Z' },
  { id: 2, nombre: 'Renovaciones Junio', supervisor_id: 32, creado_por: 22, total_dnis: 6, asignados: 2, created_at: '2026-05-10T14:30:00Z' },
  { id: 3, nombre: 'Base Nuevos Clientes Julio', supervisor_id: 39, creado_por: 22, total_dnis: 5, asignados: 0, created_at: '2026-05-20T09:00:00Z' },
]

const LOTE_DNIS_SEMILLA = [
  // Lote 1 - Ricardo Gutiérrez (Perú Alpha) - Asesores id: 26 (Andrea), 27 (Bruno)
  { id: 1, lote_id: 1, dni: '12345678A', asesor_id: 26, estado: 'asignado', created_at: '2026-05-02T10:00:00Z' },
  { id: 2, lote_id: 1, dni: '23456789B', asesor_id: 27, estado: 'asignado', created_at: '2026-05-02T10:00:00Z' },
  { id: 3, lote_id: 1, dni: '34567890C', asesor_id: 26, estado: 'asignado', created_at: '2026-05-02T10:00:00Z' },
  { id: 4, lote_id: 1, dni: '45678901D', asesor_id: null, estado: 'pendiente', created_at: '2026-05-02T10:00:00Z' },
  { id: 5, lote_id: 1, dni: '56789012E', asesor_id: null, estado: 'pendiente', created_at: '2026-05-02T10:00:00Z' },
  { id: 6, lote_id: 1, dni: '67890123F', asesor_id: null, estado: 'pendiente', created_at: '2026-05-02T10:00:00Z' },
  { id: 7, lote_id: 1, dni: '78901234G', asesor_id: null, estado: 'pendiente', created_at: '2026-05-02T10:00:00Z' },
  { id: 8, lote_id: 1, dni: '89012345H', asesor_id: null, estado: 'pendiente', created_at: '2026-05-02T10:00:00Z' },
  // Lote 2 - Valeria Paredes (Perú Beta) - Asesores id: 33 (Hilda)
  { id: 9, lote_id: 2, dni: '90123456I', asesor_id: 33, estado: 'asignado', created_at: '2026-05-10T14:30:00Z' },
  { id: 10, lote_id: 2, dni: '01234567J', asesor_id: 33, estado: 'asignado', created_at: '2026-05-10T14:30:00Z' },
  { id: 11, lote_id: 2, dni: '11223344K', asesor_id: null, estado: 'pendiente', created_at: '2026-05-10T14:30:00Z' },
  { id: 12, lote_id: 2, dni: '22334455L', asesor_id: null, estado: 'pendiente', created_at: '2026-05-10T14:30:00Z' },
  { id: 13, lote_id: 2, dni: '33445566M', asesor_id: null, estado: 'pendiente', created_at: '2026-05-10T14:30:00Z' },
  { id: 14, lote_id: 2, dni: '44556677N', asesor_id: null, estado: 'pendiente', created_at: '2026-05-10T14:30:00Z' },
  // Lote 3 - Javier Moreno (España Delta) - Sin asignar
  { id: 15, lote_id: 3, dni: '55667788O', asesor_id: null, estado: 'pendiente', created_at: '2026-05-20T09:00:00Z' },
  { id: 16, lote_id: 3, dni: '66778899P', asesor_id: null, estado: 'pendiente', created_at: '2026-05-20T09:00:00Z' },
  { id: 17, lote_id: 3, dni: '77889900Q', asesor_id: null, estado: 'pendiente', created_at: '2026-05-20T09:00:00Z' },
]

// ── Seed data into localStorage ───────────────────────────────
function seedData() {
  const existingLotes = localStorage.getItem(LOTES_KEY)
  if (!existingLotes || JSON.parse(existingLotes).length === 0) {
    localStorage.setItem(LOTES_KEY, JSON.stringify(LOTES_SEMILLA))
  }
  const existingDnis = localStorage.getItem(LOTES_DNIS_KEY)
  if (!existingDnis || JSON.parse(existingDnis).length === 0) {
    localStorage.setItem(LOTES_DNIS_KEY, JSON.stringify(LOTE_DNIS_SEMILLA))
  }
}

function getLotes() { seedData(); return JSON.parse(localStorage.getItem(LOTES_KEY) || '[]') }
function getLoteDnis() { seedData(); return JSON.parse(localStorage.getItem(LOTES_DNIS_KEY) || '[]') }
function saveLotes(lista) { localStorage.setItem(LOTES_KEY, JSON.stringify(lista)) }
function saveLoteDnis(lista) { localStorage.setItem(LOTES_DNIS_KEY, JSON.stringify(lista)) }
function getUsuarios() {
  if (_usuariosCache.length > 0) return _usuariosCache
  const raw = localStorage.getItem(USUARIOS_KEY)
  if (raw) {
    _usuariosCache = JSON.parse(raw)
    return _usuariosCache
  }
  return []
}

// ── Cargar usuarios desde Supabase ────────────────────────────
async function fetchUsuariosAsync() {
  try {
    const { data, error } = await supabase.from(TABLA_USUARIOS).select('*')
    if (data && !error && data.length > 0) {
      _usuariosCache = data
      return true
    }
  } catch (e) {
    console.warn('Supabase usuarios no disponible, usando localStorage', e.message)
  }
  // Fallback: cargar desde localStorage si existe
  const raw = localStorage.getItem(USUARIOS_KEY)
  if (raw) {
    _usuariosCache = JSON.parse(raw)
    return _usuariosCache.length > 0
  }
  return false
}

// ── Formateo de fecha ────────────────────────────────────────
function formatearFecha(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

// ── Obtener usuarios del supervisor (sus asesores) ────────────
function getAsesoresDeSupervisor(supervisorId) {
  return getUsuarios().filter(u => u.rol === 'asesor' && u.supervisor_id === supervisorId && u.activo !== false)
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export default function Lotes() {
  // Forzar re-render cuando lleguen datos de Supabase
  const [supaReady, setSupaReady] = useState(false)

  const [lotes, setLotes] = useState([])
  const [loteDnis, setLoteDnis] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [loteExpandido, setLoteExpandido] = useState(null)

  // Modal nuevo lote
  const [showNuevoLote, setShowNuevoLote] = useState(false)
  const [nuevoLoteForm, setNuevoLoteForm] = useState({ nombre: '', supervisor_id: '' })
  const [nuevoLoteError, setNuevoLoteError] = useState('')
  const fileInputRef = useRef(null)

  // Modal asignar asesores
  const [showAsignar, setShowAsignar] = useState(false)
  const [asignarLoteId, setAsignarLoteId] = useState(null)
  const [asignaciones, setAsignaciones] = useState({})
  const [asignarMsg, setAsignarMsg] = useState('')
  const [guardando, setGuardando] = useState(false)

  const refresh = () => {
    setLotes(getLotes())
    setLoteDnis(getLoteDnis())
    setLoading(false)
  }

  // ── Cargar lotes desde localStorage y usuarios desde Supabase ──
  useEffect(() => {
    refresh()
    fetchUsuariosAsync().then((ok) => {
      if (ok) {
        setSupaReady(true)
      }
    })
  }, [])

  // ── Filtro de lotes ───────────────────────────────────────────
  const lotesFiltrados = useMemo(() => {
    let result = [...lotes]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(l => l.nombre.toLowerCase().includes(q))
    }
    return result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [lotes, search])

  // ── Obtener DNIs de un lote específico ──────────────────────
  const getDnisDeLote = (loteId) => loteDnis.filter(d => d.lote_id === loteId)

  // ── Obtener nombre de usuario por id ─────────────────────────
  const getNombreUsuario = (userId) => {
    if (!userId) return '—'
    const u = getUsuarios().find(u => u.id === userId)
    return u ? u.nombre || u.usuario : 'ID ' + userId
  }

  // ── Supervisores disponibles (se actualiza cuando llegan datos de Supabase) ──
  const supervisores = useMemo(() => {
    return getUsuarios().filter(u => u.rol === 'supervisor' && u.activo !== false)
  }, [supaReady])

  // ══════════════════════════════════════════════════════════════
  // NUEVO LOTE
  // ══════════════════════════════════════════════════════════════

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target.result
      const dnis = extraerDnis(text)

      if (dnis.length === 0) {
        setNuevoLoteError('No se encontraron DNIs válidos en el archivo.')
        return
      }

      if (!nuevoLoteForm.nombre.trim()) {
        setNuevoLoteError('Debes escribir un nombre para el lote.')
        return
      }

      if (!nuevoLoteForm.supervisor_id) {
        setNuevoLoteError('Debes seleccionar un supervisor.')
        return
      }

      crearLote(dnis)
    }
    reader.readAsText(file)
  }

  function extraerDnis(texto) {
    const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)
    const dnis = []
    for (const linea of lineas) {
      // Remove BOM and quotes
      let limpio = linea.replace(/^\uFEFF/, '').replace(/["']/g, '')
      if (limpio.includes(',') || limpio.includes(';')) {
        // CSV - try each cell
        const cells = limpio.split(/[,;]/).map(c => c.trim()).filter(Boolean)
        for (const cell of cells) {
          const dni = cell.replace(/[^a-zA-Z0-9]/g, '').trim()
          if (dni.length >= 6) dnis.push(dni)
        }
      } else {
        const dni = limpio.replace(/[^a-zA-Z0-9]/g, '').trim()
        if (dni.length >= 6) dnis.push(dni)
      }
    }
    // Remove duplicates while preserving order
    return [...new Set(dnis)]
  }

  function crearLote(dnis) {
    const lotesActuales = getLotes()
    const dnisActuales = getLoteDnis()
    const superId = parseInt(nuevoLoteForm.supervisor_id)

    const nuevoLote = {
      id: nextId(lotesActuales),
      nombre: nuevoLoteForm.nombre.trim(),
      supervisor_id: superId,
      creado_por: myId,
      total_dnis: dnis.length,
      asignados: 0,
      created_at: new Date().toISOString(),
    }

    const nuevosDnis = dnis.map((dni, i) => ({
      id: nextId(dnisActuales) + i,
      lote_id: nuevoLote.id,
      dni,
      asesor_id: null,
      estado: 'pendiente',
      created_at: new Date().toISOString(),
    }))

    saveLotes([...lotesActuales, nuevoLote])
    saveLoteDnis([...dnisActuales, ...nuevosDnis])

    setShowNuevoLote(false)
    setNuevoLoteForm({ nombre: '', supervisor_id: '' })
    setNuevoLoteError('')
    refresh()
  }

  const handleCrearLoteVacio = () => {
    if (!nuevoLoteForm.nombre.trim()) {
      setNuevoLoteError('Debes escribir un nombre para el lote.')
      return
    }
    if (!nuevoLoteForm.supervisor_id) {
      setNuevoLoteError('Debes seleccionar un supervisor.')
      return
    }
    crearLote([])
  }

  // ══════════════════════════════════════════════════════════════
  // ASIGNAR ASESORES
  // ══════════════════════════════════════════════════════════════

  const abrirAsignar = (loteId) => {
    const dnis = getDnisDeLote(loteId)
    const asignInicial = {}
    dnis.forEach(d => { asignInicial[d.id] = d.asesor_id || '' })
    setAsignaciones(asignInicial)
    setAsignarLoteId(loteId)
    setAsignarMsg('')
    setShowAsignar(true)
  }

  const loteAsignarActual = lotes.find(l => l.id === asignarLoteId)
  const dnisLoteActual = useMemo(() => {
    return loteDnis.filter(d => d.lote_id === asignarLoteId)
  }, [loteDnis, asignarLoteId])

  const asesoresDisponibles = useMemo(() => {
    if (!loteAsignarActual) return []
    return getAsesoresDeSupervisor(loteAsignarActual.supervisor_id)
  }, [loteAsignarActual])

  const statsLote = useMemo(() => {
    const total = dnisLoteActual.length
    const asignados = dnisLoteActual.filter(d => d.asesor_id).length
    return { total, asignados, pendientes: total - asignados }
  }, [dnisLoteActual])

  const handleGuardarAsignaciones = () => {
    setGuardando(true)
    setAsignarMsg('')
    const todosDnis = getLoteDnis()
    let cambios = 0

    const nuevos = todosDnis.map(d => {
      if (d.lote_id === asignarLoteId && asignaciones[d.id] !== undefined) {
        const nuevoAsesor = asignaciones[d.id] ? parseInt(asignaciones[d.id]) : null
        if (d.asesor_id !== nuevoAsesor) {
          cambios++
          return { ...d, asesor_id: nuevoAsesor, estado: nuevoAsesor ? 'asignado' : 'pendiente' }
        }
      }
      return d
    })

    saveLoteDnis(nuevos)

    // Actualizar contadores del lote
    const lotesAct = getLotes()
    const dnisLote = nuevos.filter(d => d.lote_id === asignarLoteId)
    const asignadosCount = dnisLote.filter(d => d.asesor_id).length
    const loteIdx = lotesAct.findIndex(l => l.id === asignarLoteId)
    if (loteIdx !== -1) {
      lotesAct[loteIdx].asignados = asignadosCount
      saveLotes(lotesAct)
    }

    setAsignarMsg(`✓ ${cambios} cambio${cambios !== 1 ? 's' : ''} guardado${cambios !== 1 ? 's' : ''}`)
    setGuardando(false)
    refresh()
    setTimeout(() => setAsignarMsg(''), 2000)
  }

  // ══════════════════════════════════════════════════════════════
  // ELIMINAR LOTE
  // ══════════════════════════════════════════════════════════════

  const handleEliminarLote = (loteId, nombre) => {
    if (!confirm(`¿Eliminar el lote "${nombre}" y todos sus DNIs asociados?`)) return
    const lotesAct = getLotes().filter(l => l.id !== loteId)
    const dnisAct = getLoteDnis().filter(d => d.lote_id !== loteId)
    saveLotes(lotesAct)
    saveLoteDnis(dnisAct)
    if (loteExpandido === loteId) setLoteExpandido(null)
    refresh()
  }

  // ══════════════════════════════════════════════════════════════
  // EXPORTAR
  // ══════════════════════════════════════════════════════════════

  const exportarLote = (lote) => {
    const dnis = getDnisDeLote(lote.id)
    const usuarios = getUsuarios()
    let csv = 'DNI,Asesor,Estado\n'
    dnis.forEach(d => {
      const asesor = d.asesor_id ? (usuarios.find(u => u.id === d.asesor_id)?.nombre || '—') : '—'
      csv += `${d.dni},${asesor},${d.estado}\n`
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${lote.nombre.replace(/\s+/g, '_')}_DNIs.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-[#1495e0]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1a1030] flex items-center gap-2"><Package size={22} className="text-oratioo-purple" /> Gestión de Lotes</h1>
          <p className="text-sm text-[#7c757c] mt-1">
            {lotes.length} lote{lotes.length !== 1 ? 's' : ''} registrado{lotes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setNuevoLoteForm({ nombre: '', supervisor_id: '' })
              setNuevoLoteError('')
              setShowNuevoLote(true)
            }}
            className="bg-[#1495e0] hover:bg-[#0f7cc0] text-white flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg transition-all shadow-sm"
          >
            <Plus size={16} />
            Nuevo lote
          </button>
          <button onClick={refresh} className="btn-primary p-2" title="Recargar">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="card !p-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7c757c]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar lote por nombre..."
            className="w-full bg-white border border-[#e0e0f0] rounded-lg pl-9 pr-8 py-2 text-sm text-[#1a1030] placeholder-[#7c757c] focus:outline-none focus:ring-2 focus:ring-[#1495e0]/20 focus:border-[#1495e0]"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7c757c] hover:text-[#1495e0]">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Lista de lotes */}
      {lotesFiltrados.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <Package size={40} className="text-[#b8b0b8] mb-3" />
          <p className="text-[#7c757c] text-sm">No hay lotes</p>
          <button
            onClick={() => { setNuevoLoteForm({ nombre: '', supervisor_id: '' }); setNuevoLoteError(''); setShowNuevoLote(true) }}
            className="mt-3 text-[#1495e0] text-sm hover:underline"
          >
            Crear el primer lote
          </button>
        </div>
      ) : (
        lotesFiltrados.map(lote => {
          const estaExpandido = loteExpandido === lote.id
          const dnis = getDnisDeLote(lote.id)
          const asignados = dnis.filter(d => d.asesor_id).length
          const pendientes = dnis.length - asignados

          return (
            <div key={lote.id} className="card !p-0 overflow-hidden">
              {/* Cabecera del lote */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[#f8f6fb] transition-colors"
                onClick={() => setLoteExpandido(estaExpandido ? null : lote.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button className="p-0.5 rounded hover:bg-[#e8dce6] transition-colors shrink-0">
                    {estaExpandido ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#1a1030] truncate">{lote.nombre}</h3>
                    <p className="text-xs text-[#7c757c] mt-0.5">
                      Por {getNombreUsuario(lote.creado_por)} · {formatearFecha(lote.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {/* Stats rápidas */}
                  <div className="hidden sm:flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1 text-[#7c757c]">
                      <Users size={13} />
                      {dnis.length} DNIs
                    </span>
                    <span className="flex items-center gap-1 text-emerald-600">
                      <UserCheck size={13} />
                      {asignados}
                    </span>
                    <span className="flex items-center gap-1 text-amber-600">
                      <Clock size={13} />
                      {pendientes}
                    </span>
                  </div>
                  <span className="text-xs text-[#7c757c] bg-[#f0f0f8] rounded-full px-2.5 py-1">
                    {getNombreUsuario(lote.supervisor_id)}
                  </span>
                </div>
              </div>

              {/* Detalle expandido */}
              {estaExpandido && (
                <div className="border-t border-[#e8dce6] animate-slide-in">
                  <div className="p-5 space-y-4">
                    {/* Info del lote */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-[#f8f6fb] rounded-lg p-3">
                        <p className="text-xs text-[#7c757c]">Total DNIs</p>
                        <p className="text-lg font-bold text-[#1a1030]">{dnis.length}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-3">
                        <p className="text-xs text-emerald-600">Asignados</p>
                        <p className="text-lg font-bold text-emerald-700">{asignados}</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-3">
                        <p className="text-xs text-amber-600">Pendientes</p>
                        <p className="text-lg font-bold text-amber-700">{pendientes}</p>
                      </div>
                      <div className="bg-[#e6f3fb] rounded-lg p-3">
                        <p className="text-xs text-[#1495e0]">Supervisor</p>
                        <p className="text-sm font-bold text-[#1a1030]">{getNombreUsuario(lote.supervisor_id)}</p>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-2 flex-wrap">
                                    <button
                          onClick={() => abrirAsignar(lote.id)}
                          className="bg-[#1495e0] hover:bg-[#0f7cc0] text-white flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg transition-all"
                        >
                          <Users size={14} />
                          Asignar asesores
                        </button>
                        <button
                          onClick={() => handleEliminarLote(lote.id, lote.nombre)}
                          className="border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                          Eliminar lote
                        </button>
                      <button
                        onClick={() => exportarLote(lote)}
                        className="border border-[#e0e0f0] text-[#7c757c] hover:bg-[#f0f0f8] flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg transition-all"
                      >
                        <Download size={14} />
                        Exportar CSV
                      </button>
                    </div>

                    {/* Tabla de DNIs del lote */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[#e8dce6]">
                            <th className="table-header px-3 py-2">#</th>
                            <th className="table-header px-3 py-2">DNI</th>
                            <th className="table-header px-3 py-2">Asesor</th>
                            <th className="table-header px-3 py-2">Estado</th>
                            <th className="table-header px-3 py-2">Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dnis.map((d, i) => {
                            const asesor = d.asesor_id ? getNombreUsuario(d.asesor_id) : '—'
                            return (
                              <tr key={d.id} className="border-b border-[#e8dce6] hover:bg-[#f5ebf3]/30 transition-colors">
                                <td className="table-cell text-xs text-[#7c757c]">{i + 1}</td>
                                <td className="table-cell font-mono text-sm font-medium">{d.dni}</td>
                                <td className="table-cell text-sm">{asesor}</td>
                                <td className="table-cell">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                                    d.estado === 'asignado'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : d.estado === 'completado'
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'bg-amber-50 text-amber-600'
                                  }`}>
                                    {d.estado === 'asignado' ? <UserCheck size={12} /> : <Clock size={12} />}
                                    {d.estado === 'asignado' ? 'Asignado' : d.estado === 'completado' ? 'Completado' : 'Pendiente'}
                                  </span>
                                </td>
                                <td className="table-cell text-xs text-[#7c757c]">{formatearFecha(d.created_at)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL: NUEVO LOTE */}
      {/* ══════════════════════════════════════════════════════════ */}
      {showNuevoLote && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNuevoLote(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#1a1030]">Nuevo lote de DNIs</h2>
              <button onClick={() => setShowNuevoLote(false)} className="p-1 rounded hover:bg-[#f0f0f8] transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Nombre del lote */}
              <div>
                <label className="block text-xs text-[#7c757c] font-medium mb-1">
                  Nombre del lote <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={nuevoLoteForm.nombre}
                  onChange={e => setNuevoLoteForm({ ...nuevoLoteForm, nombre: e.target.value })}
                  className="input-field text-sm"
                  placeholder="ej: Campaña Julio - Clientes Preferentes"
                  autoFocus
                />
              </div>

              {/* Supervisor destino */}
              <div>
                <label className="block text-xs text-[#7c757c] font-medium mb-1">
                  Supervisor destino <span className="text-red-400">*</span>
                </label>
                <select
                  value={nuevoLoteForm.supervisor_id}
                  onChange={e => setNuevoLoteForm({ ...nuevoLoteForm, supervisor_id: e.target.value })}
                  className="input-field text-sm"
                >
                  <option value="">Seleccionar supervisor...</option>
                  {supervisores.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre || s.usuario}</option>
                  ))}
                </select>
              </div>

              {/* Subir archivo */}
              <div>
                <label className="block text-xs text-[#7c757c] font-medium mb-1">
                  Archivo de DNIs (Excel/CSV/TXT)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#e0e0f0] rounded-xl p-6 text-center cursor-pointer hover:border-[#1495e0] hover:bg-[#e6f3fb]/30 transition-all"
                >
                  <Upload size={24} className="mx-auto mb-2 text-[#1495e0]" />
                  <p className="text-sm text-[#7c757c]">Haz clic para seleccionar un archivo</p>
                  <p className="text-xs text-[#b8b0b8] mt-1">CSV, Excel o TXT con un DNI por línea</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* O crear vacío */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#e0e0f0]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-[#7c757c]">o crea un lote vacío</span>
                </div>
              </div>

              {/* Error */}
              {nuevoLoteError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {nuevoLoteError}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowNuevoLote(false)}
                  className="flex-1 border border-[#e0e0f0] rounded-lg py-2.5 text-sm text-[#7c757c] hover:bg-[#f0f0f8] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCrearLoteVacio}
                  className="flex-1 bg-[#1495e0] hover:bg-[#0f7cc0] text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
                >
                  Crear lote vacío
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL: ASIGNAR ASESORES */}
      {/* ══════════════════════════════════════════════════════════ */}
      {showAsignar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAsignar(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#e8dce6] shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-[#1a1030]">{loteAsignarActual?.nombre}</h2>
                <p className="text-xs text-[#7c757c] mt-1">
                  {statsLote.total} DNIs · {statsLote.asignados} asignados · {statsLote.pendientes} pendientes
                </p>
              </div>
              <button onClick={() => setShowAsignar(false)} className="p-1 rounded hover:bg-[#f0f0f8] transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Tabla de DNIs */}
            <div className="overflow-y-auto flex-1 p-6">
              {asesoresDisponibles.length === 0 ? (
                <div className="text-center py-8">
                  <Users size={32} className="text-[#b8b0b8] mx-auto mb-2" />
                  <p className="text-sm text-[#7c757c]">No hay asesores disponibles para este supervisor.</p>
                  <p className="text-xs text-[#b8b0b8] mt-1">Primero registra asesores asignados a este supervisor en Usuarios.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#e8dce6]">
                      <th className="table-header px-3 py-2 text-left">#</th>
                      <th className="table-header px-3 py-2 text-left">DNI</th>
                      <th className="table-header px-3 py-2 text-left">Asignar a</th>
                      <th className="table-header px-3 py-2 text-left">Estado actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dnisLoteActual.map((d, i) => (
                      <tr key={d.id} className="border-b border-[#e8dce6] hover:bg-[#f5ebf3]/30 transition-colors">
                        <td className="table-cell text-xs text-[#7c757c]">{i + 1}</td>
                        <td className="table-cell font-mono text-sm font-medium">{d.dni}</td>
                        <td className="table-cell">
                          <select
                            value={asignaciones[d.id] || ''}
                            onChange={e => setAsignaciones(prev => ({ ...prev, [d.id]: e.target.value }))}
                            className="border border-[#e0e0f0] rounded-lg px-2.5 py-1.5 text-sm min-w-[160px] focus:outline-none focus:ring-2 focus:ring-[#1495e0]/20 focus:border-[#1495e0]"
                          >
                            <option value="">Sin asignar</option>
                            {asesoresDisponibles.map(a => (
                              <option key={a.id} value={a.id}>{a.nombre || a.usuario}</option>
                            ))}
                          </select>
                        </td>
                        <td className="table-cell">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                            d.asesor_id ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {d.asesor_id ? 'Asignado' : 'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[#e8dce6] p-4 shrink-0">
              {asignarMsg && (
                <p className="text-sm text-emerald-600 mb-2">{asignarMsg}</p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowAsignar(false)}
                  className="border border-[#e0e0f0] rounded-lg py-2 px-4 text-sm text-[#7c757c] hover:bg-[#f0f0f8] transition-colors"
                >
                  Cerrar
                </button>
                <button
                  onClick={handleGuardarAsignaciones}
                  disabled={guardando || asesoresDisponibles.length === 0}
                  className="bg-[#1495e0] hover:bg-[#0f7cc0] text-white flex items-center gap-2 rounded-lg py-2 px-4 text-sm font-medium transition-colors disabled:opacity-40"
                >
                  {guardando ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  {guardando ? 'Guardando...' : 'Guardar asignaciones'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
