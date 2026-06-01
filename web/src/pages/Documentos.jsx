import React, { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Upload, FileSpreadsheet, FileText, File, X, CheckCircle2, AlertCircle,
  Loader2, Clock, Eye, Database, Trash2, RefreshCw, ChevronDown, ChevronRight,
  List, AlertTriangle,
} from 'lucide-react'
import { supabase } from '../supabaseClient'
import BotStatus from '../components/BotStatus'

// Convertir created_at (UTC) a fecha local YYYY-MM-DD
function utcToLocalDate(isoStr) {
  if (!isoStr) return 'sin_fecha'
  const d = new Date(isoStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + day
}


function extractDNIs(text) {
  const dnis = new Set()
  const clean = text.replace(/^\uFEFF/, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\u200B-\u200F\uFEFF]/g, '')
    .replace(/["'\u2018\u2019\u201C\u201D_]/g, '')
  const matches = clean.match(/\b(?:[A-Za-z]\d{8}|\d{7,8}[A-Za-z]|[A-Za-z]\d{7}[A-Za-z])\b/g)
  const nieGuiones = clean.match(/\b[A-Za-z]-\d{7}-[A-Za-z]\b/g)
  if (matches) matches.forEach(d => dnis.add(d.toUpperCase()))
  if (nieGuiones) nieGuiones.forEach(d => dnis.add(d.toUpperCase().replace(/-/g, '')))
  return Array.from(dnis)
}

function detectColumn(headers) {
  const dniKeywords = ['dni', 'documento', 'identidad', 'nrodocumento', 'num_doc', 'documento_identidad', 'cedula', 'id']
  for (const h of headers) {
    const hclean = h.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (dniKeywords.some(k => hclean.includes(k))) return h
  }
  return headers[0]
}

export default function Documentos() {
  const [files, setFiles] = useState([])
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [agenteActivo, setAgenteActivo] = useState(false)
  const [expandedDay, setExpandedDay] = useState(null)
  const [dayDetails, setDayDetails] = useState({})
  const [maquinasDisponibles, setMaquinasDisponibles] = useState([])
  const [selectedMaquinas, setSelectedMaquinas] = useState({})
  const [workersConfig, setWorkersConfig] = useState({})
  const [analisisEnCurso, setAnalisisEnCurso] = useState(false)
  const [maquinasTrabajando, setMaquinasTrabajando] = useState({}) // { nombre: true }

  function hoyLocal() {
    const d = new Date()
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
  }

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const { data, error } = await supabase.from('documentos').select('*').order('created_at', { ascending: false }).limit(100)
      if (error) throw error
      setUploaded(data || [])
    } catch (err) {
      console.error('Error cargando historial:', err?.message || err)
      setUploaded([])
    } finally { setLoadingHistory(false) }
  }

  useEffect(() => { fetchHistory() }, [])
  useEffect(() => {
    const interval = setInterval(fetchHistory, 300000)
    return () => clearInterval(interval)
  }, [])
  // Cuando uploaded cambia, limpiar detalles expandidos (se recargan al hacer click)
  useEffect(() => {
    if (expandedDay) {
      setDayDetails({})
    }
  }, [uploaded.length])

  // Cargar máquinas activas
  const fetchMaquinas = async () => {
    const ahora = Date.now()
    const { data } = await supabase.from('maquinas').select('nombre,estado,ultimo_heartbeat,workers_config,workers_info').limit(20)
    const activas = (data || []).filter(m => {
      if (m.estado !== 'conectado' && m.estado !== 'activo') return false
      if (!m.ultimo_heartbeat) return false
      return (ahora - new Date(m.ultimo_heartbeat).getTime()) < 25000
    })
    setMaquinasDisponibles(activas)
    // Seleccionar todas por defecto
    const sel = {}
    const wc = {}
    for (const m of activas) {
      sel[m.nombre] = true
      wc[m.nombre] = parseInt(m.workers_config) || 1
    }
    setSelectedMaquinas(sel)
    setWorkersConfig(wc)
    // Verificar workers activos (deben reportar actividad, no solo en_progreso)
    try {
      let workersReportando = false
      const trabajando = {}
      for (const m of activas) {
        const info = m.workers_info
        if (Array.isArray(info) && info.some(w => (w.estado === 'activo' || w.dni_actual))) {
          workersReportando = true
          trabajando[m.nombre] = true
        }
      }
      setAnalisisEnCurso(workersReportando)
      setMaquinasTrabajando(trabajando)
    } catch {}
  }
  useEffect(() => { fetchMaquinas() }, [])

  // Verificar agente activo cada 10s
  const checkAgente = async () => {
    try {
      const ahora = Date.now()
      const { data } = await supabase.from('maquinas').select('nombre,estado,ultimo_heartbeat').limit(10)
      const activo = (data || []).some(m => {
        if (m.estado !== 'conectado' && m.estado !== 'activo') return false
        if (!m.ultimo_heartbeat) return false
        return (ahora - new Date(m.ultimo_heartbeat).getTime()) < 25000
      })
      setAgenteActivo(activo)
    } catch { setAgenteActivo(false) }
  }
  useEffect(() => {
    checkAgente()
    fetchMaquinas()
    const interval = setInterval(() => { checkAgente(); fetchMaquinas() }, 10000)
    return () => clearInterval(interval)
  }, [])

  // ── Queue / Lote stats ──
  const [queueStats, setQueueStats] = useState({ total: 0, pendientes: 0, en_progreso: 0, completados: 0, errores: 0 })
  const [resetting, setResetting] = useState(false)
  const [resetMsg, setResetMsg] = useState({ status: '', text: '' }) // { status: 'ok'|'error', text: '' }

  const loadQueueStats = async () => {
    try {
      // Consultas COUNT directas (sin limite, precisas)
      const [totalRes, pendientesRes, progRes, compRes, errRes] = await Promise.all([
        supabase.from('lineas').select('*', { count: 'exact', head: true }),
        supabase.from('lineas').select('*', { count: 'exact', head: true }).filter('atributos_dinamicos->>estado', 'eq', 'pendiente'),
        supabase.from('lineas').select('*', { count: 'exact', head: true }).filter('atributos_dinamicos->>estado', 'eq', 'en_progreso'),
        supabase.from('lineas').select('*', { count: 'exact', head: true }).filter('atributos_dinamicos->>estado', 'eq', 'completado'),
        supabase.from('lineas').select('*', { count: 'exact', head: true }).filter('atributos_dinamicos->>estado', 'eq', 'error'),
      ])
      setQueueStats({
        total: totalRes.count || 0,
        pendientes: (pendientesRes.count || 0) + (progRes.count || 0),
        completados: compRes.count || 0,
        errores: errRes.count || 0,
      })
    } catch {}
  }

  useEffect(() => {
    loadQueueStats()
    const interval = setInterval(loadQueueStats, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleResetLote = async () => {
    setResetting(true)
    setResetMsg({ status: '', text: '' })
    try {
      const { error } = await supabase.from('comandos_bot').insert({
        maquina_destino: 'PC-Jeff', comando: 'reset_queue',
        parametros: {}, estado: 'pendiente',
      })
      if (error) throw error
      setResetMsg({ status: 'ok', text: 'Comando enviado. Recargando cola desde numeros.txt...' })
      setTimeout(loadQueueStats, 2000)
    } catch (err) {
      setResetMsg({ status: 'error', text: err.message || 'Error al enviar comando' })
    }
    setResetting(false)
    setTimeout(() => setResetMsg({ status: '', text: '' }), 5000)
  }

  const onDrop = useCallback((acceptedFiles) => {
    setError('')
    setFiles(prev => [...prev, ...acceptedFiles.map(f => ({
      id: `${f.name}-${Date.now()}`,
      file: f, name: f.name, size: f.size, type: f.type || f.name.split('.').pop(),
    }))])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
    },
  })

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id))
    if (preview?.id === id) setPreview(null)
  }

  const previewFile = async (fileData) => {
    setError('')
    try {
      const text = await fileData.file.text()
      const lines = text.split('\n').filter(Boolean)
      const headers = (lines[0] || '').split(/[,;\t|]/).map(h => h.trim().replace(/^"|"$/g, ''))
      setPreview({ id: fileData.id, name: fileData.name, headers, detectedCol: detectColumn(headers), dnis: extractDNIs(text), totalLines: lines.length, sample: lines.slice(0, 6) })
    } catch (err) {
      setError('No se pudo leer el archivo.')
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) return
    setUploading(true)
    setError('')
    const errores = []
    try {
      for (const f of files) {
        const ext = f.name.split('.').pop().toLowerCase()
        if (['xlsx', 'xls'].includes(ext)) { errores.push(f.name + ' es binario.'); continue }
        const text = await f.file.text()
        const dnis = extractDNIs(text)
        if (dnis.length === 0) { errores.push('No hay DNIs en ' + f.name); continue }
        const { data: doc, error: errDoc } = await supabase.from('documentos').insert({
          nombre_archivo: f.name, semana: new Date().toISOString().slice(0, 7),
          total_dnis: dnis.length, procesados: 0, pendientes: dnis.length, errores: 0, no_encontrados: 0,
        }).select().single()
        if (errDoc) { errores.push('Error: ' + f.name); continue }
        for (let i = 0; i < dnis.length; i += 500) {
          const batch = dnis.slice(i, i + 500).map(dni => ({
            dni, nombre: 'N/A', direccion: 'N/A', linea: 'N/A', paquete: 'N/A',
            atributos_dinamicos: { estado: 'pendiente', datos_basicos: { nombre: 'N/A', direccion: 'N/A' }, pipeline: { estado: 'pendiente', asesor_id: null, notas: '' }, documento_id: doc.id },
          }))
          await supabase.from('lineas').insert(batch).select('id', { count: 'exact', head: true })
        }
      }
      await fetchHistory()
      setFiles([])
      setPreview(null)
      setError(errores.length > 0 ? errores.join(' | ') : '')
    } catch (err) { setError('Error: ' + err.message) }
    finally { setUploading(false) }
  }

  // ── Iniciar análisis de TODOS los documentos pendientes ──
  const handleStartAnalysis = async () => {
    const pendientes = uploaded.filter(d => d.estado !== 'completado' || !d.estado)

    if (pendientes.length === 0) {
      alert('No hay documentos pendientes. Si quieres re-analizar, elimina el documento y súbelo de nuevo.')
      return
    }

    setAnalyzing(true)

    await fetchHistory()

    // Usar máquinas seleccionadas
    const seleccionadas = maquinasDisponibles.filter(m => selectedMaquinas[m.nombre])
    if (seleccionadas.length === 0) {
      alert('Selecciona al menos una máquina.')
      setAnalyzing(false); return
    }

    const comandos = seleccionadas.map(m => ({
      maquina_destino: m.nombre, comando: 'iniciar',
      parametros: { workers_config: workersConfig, documento_id: null, documento_nombre: 'todos' },
      estado: 'pendiente',
    }))
    await supabase.from('comandos_bot').insert(comandos)

    // Marcar pendientes como analizando
    for (const doc of pendientes) {
      await supabase.from('documentos').update({ estado: 'analizando' }).eq('id', doc.id)
    }
    await fetchHistory()

    // Monitorear progreso de todos los documentos
    const interval = setInterval(async () => {
      const docs = await supabase.from('documentos').select('id,total_dnis,procesados').order('created_at', { ascending: false }).limit(100)
      if (docs.data) {
        let todosTerminados = true
        for (const d of docs.data) {
          const { count } = await supabase.from('lineas').select('id', { count: 'exact', head: true })
            .filter('atributos_dinamicos->>documento_id', 'eq', String(d.id))
            .not('atributos_dinamicos->>estado', 'eq', 'pendiente')
          const proc = parseInt(count) || 0
          if (proc >= d.total_dnis) {
            await supabase.from('documentos').update({ estado: 'completado', procesados: proc }).eq('id', d.id)
          } else {
            todosTerminados = false
          }
        }
        await fetchHistory()
        if (todosTerminados) {
          clearInterval(interval)
          setAnalyzing(false)
        }
      }
    }, 3000)
  }

  const toggleDay = async (dia, docs) => {
    if (expandedDay === dia) {
      setExpandedDay(null)
      return
    }
    setExpandedDay(dia)
    // Cargar conteo de DNIs por documento para este día
    const docIds = docs.map(d => d.id)
    const detalles = {}
    for (const id of docIds) {
      try {
        const { count: total } = await supabase.from('lineas').select('id', { count: 'exact', head: true })
          .filter('atributos_dinamicos->>documento_id', 'eq', String(id))
        const { count: procesados } = await supabase.from('lineas').select('id', { count: 'exact', head: true })
          .filter('atributos_dinamicos->>documento_id', 'eq', String(id))
          .not('atributos_dinamicos->>estado', 'eq', 'pendiente')
        const { count: noClientes } = await supabase.from('lineas').select('id', { count: 'exact', head: true })
          .filter('atributos_dinamicos->>documento_id', 'eq', String(id))
          .filter('atributos_dinamicos->>estado', 'eq', 'no_cliente')
        const { count: errores } = await supabase.from('lineas').select('id', { count: 'exact', head: true })
          .filter('atributos_dinamicos->>documento_id', 'eq', String(id))
          .filter('atributos_dinamicos->>estado', 'eq', 'error')
        detalles[id] = { total: total || 0, procesados: procesados || 0, noClientes: noClientes || 0, errores: errores || 0 }
      } catch {}
    }
    setDayDetails(prev => ({ ...prev, [dia]: detalles }))
  }

  const handleDeleteDocument = async (doc) => {
    if (!window.confirm(`Eliminar "${doc.nombre_archivo}"?`)) return
    setDeletingId(doc.id)
    try {
      const { data: lineas } = await supabase.from('lineas').select('id')
        .filter('atributos_dinamicos->>documento_id', 'eq', String(doc.id))
      if (lineas?.length > 0) await supabase.from('lineas').delete().in('id', lineas.map(l => l.id))
      await supabase.from('documentos').delete().eq('id', doc.id)
      await fetchHistory()
    } catch (err) { alert('Error: ' + (err.message || err)) }
    finally { setDeletingId(null) }
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-oratioo-dark flex items-center gap-2">
          <Upload size={22} className="text-oratioo-purple" /> Subida de documentos
        </h1>
        <p className="text-sm text-oratioo-gray mt-1">Carga archivos .xlsx, .csv o .txt con DNIs de clientes</p>
      </div>

      <BotStatus />

      {/* ── Dropzone ── */}
      <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
        isDragActive ? 'border-oratioo-purple bg-purple-50' : 'border-oratioo-border hover:border-oratioo-purple bg-white'
      }`}>
        <input {...getInputProps()} />
        <Upload size={40} className={`mx-auto mb-3 ${isDragActive ? 'text-oratioo-gray' : 'text-oratioo-gray'}`} />
        {isDragActive ? (
          <p className="text-oratioo-gray font-medium">Suelta los archivos aquí...</p>
        ) : (
          <>
            <p className="text-oratioo-dark font-medium">Arrastra tus archivos aquí</p>
            <p className="text-oratioo-gray text-sm mt-1">o haz clic para seleccionarlos</p>
            <p className="text-oratioo-gray text-xs mt-2">Formatos: .xlsx, .xls, .csv, .txt</p>
          </>
        )}
      </div>

      {files.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-oratioo-dark">Archivos ({files.length})</h3>
            <div className="flex items-center gap-2">
              <button onClick={handleUpload} disabled={uploading} className="btn-success flex items-center gap-2 text-sm">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? 'Subiendo...' : 'Confirmar subida'}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {files.map(f => (
              <div key={f.id} className="flex items-center justify-between bg-oratioo-light/30 rounded-lg px-3 py-2 border border-oratioo-border">
                <div className="flex items-center gap-2">
                  {['xlsx', 'xls'].includes(f.name.split('.').pop().toLowerCase())
                    ? <FileSpreadsheet size={20} className="text-emerald-400" />
                    : f.name.endsWith('.csv')
                      ? <FileText size={20} className="text-oratioo-gray" />
                      : <File size={20} className="text-oratioo-gray" />}
                  <div>
                    <p className="text-sm text-oratioo-dark">{f.name}</p>
                    <p className="text-xs text-oratioo-gray">{formatSize(f.size)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => previewFile(f)} className="text-xs text-oratioo-gray hover:text-oratioo-dark p-1">
                    <Eye size={16} />
                  </button>
                  <button onClick={() => removeFile(f.id)} className="text-xs text-red-500 hover:text-red-700 p-1">
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {preview && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-oratioo-dark">{preview.name}</h3>
            <button onClick={() => setPreview(null)} className="text-oratioo-gray hover:text-oratioo-dark"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-oratioo-light/40 rounded-lg px-3 py-2 border border-oratioo-border">
              <p className="text-xs text-oratioo-gray">Líneas</p>
              <p className="text-sm font-semibold text-oratioo-dark">{preview.totalLines}</p>
            </div>
            <div className="bg-oratioo-light/40 rounded-lg px-3 py-2 border border-oratioo-border">
              <p className="text-xs text-oratioo-gray">Columna DNI</p>
              <p className="text-sm font-semibold text-oratioo-gray">{preview.detectedCol}</p>
            </div>
            <div className="bg-oratioo-light/40 rounded-lg px-3 py-2 border border-oratioo-border">
              <p className="text-xs text-oratioo-gray">DNIs</p>
              <p className="text-sm font-semibold text-oratioo-dark">{preview.dnis.length}</p>
            </div>
          </div>
          {preview.dnis.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {preview.dnis.slice(0, 20).map(d => (
                <span key={d} className="bg-oratioo-light text-xs font-mono text-oratioo-dark px-2 py-0.5 rounded border border-oratioo-border">{d}</span>
              ))}
              {preview.dnis.length > 20 && <span className="text-xs text-oratioo-gray self-center">+{preview.dnis.length - 20}</span>}
            </div>
          )}
          <pre className="text-xs text-oratioo-gray font-mono whitespace-pre-wrap bg-oratioo-light/50 rounded-lg p-3 border border-oratioo-border">
            {preview.sample.join('\n')}
          </pre>
        </div>
      )}

      {/* ── Control de Lote + Historial ── */}
      {!loadingHistory && (
        <div className="card !p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-oratioo-dark flex items-center gap-2">
              <List size={14} className="text-oratioo-purple" />
              Control de Lote
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={handleResetLote} disabled={resetting}
                className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-40">
                {resetting ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Reset lote
              </button>
            </div>
          </div>

          {/* Status message */}
          {resetMsg.status && (
            <div className={`mb-3 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 border ${
              resetMsg.status === 'ok'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {resetMsg.status === 'ok' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              {resetMsg.text}
            </div>
          )}

          {queueStats.total > 0 ? (
            <>
              {/* Barra de progreso */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-oratioo-gray">Progreso</span>
                  <span className="text-xs font-semibold text-oratioo-dark">
                    {queueStats.total > 0 ? Math.round(((queueStats.completados + queueStats.errores) / queueStats.total) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full h-2 bg-oratioo-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${queueStats.total > 0 ? Math.round(((queueStats.completados + queueStats.errores) / queueStats.total) * 100) : 0}%`,
                      background: queueStats.errores > 0
                        ? `linear-gradient(90deg, #10b981 ${queueStats.total > 0 ? Math.round((queueStats.completados / queueStats.total) * 100) : 0}%, #ef4444 ${queueStats.total > 0 ? Math.round(((queueStats.completados + queueStats.errores) / queueStats.total) * 100) : 0}%)`
                        : '#10b981'
                    }}
                  />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[9px] text-emerald-600">{queueStats.completados} completados</span>
                  {queueStats.errores > 0 && <span className="text-[9px] text-red-500">{queueStats.errores} errores</span>}
                </div>
              </div>

              {/* Counters */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { icon: Database, label: 'Total', value: queueStats.total, color: 'text-oratioo-dark bg-oratioo-light' },
                  { icon: Clock, label: 'Pendientes', value: queueStats.pendientes, color: 'text-amber-600 bg-amber-50' },
                  { icon: CheckCircle2, label: 'Completados', value: queueStats.completados, color: 'text-emerald-600 bg-emerald-50' },
                  { icon: AlertTriangle, label: 'Errores', value: queueStats.errores, color: 'text-red-500 bg-red-50' },
                ].map((s, i) => (
                  <div key={i} className={`rounded-lg px-3 py-2 text-center ${s.color.split(' ').slice(1).join(' ')}`}>
                    <p className={`text-lg font-bold ${s.color.split(' ')[0]}`}>{s.value.toLocaleString()}</p>
                    <p className="text-[9px] text-oratioo-gray">{s.label}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-oratioo-gray text-center py-4">
              No hay DNIs en cola. Haz clic en <strong>Reset lote</strong> para cargar desde <code className="bg-oratioo-light px-1 rounded">numeros.txt</code>
            </p>
          )}

          {/* ── Cargas recientes ── */}
          <div className="border-t border-oratioo-border pt-3 mt-3">
            <h4 className="text-[10px] font-semibold text-oratioo-gray uppercase tracking-wider mb-2">Últimas cargas</h4>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 size={14} className="animate-spin text-oratioo-gray" />
              </div>
            ) : uploaded.length === 0 ? (
              <p className="text-[11px] text-oratioo-gray text-center py-2">Aún no hay cargas</p>
            ) : (
              <div className="space-y-1">
                {uploaded.slice(0, 5).map(d => {
                  const completo = (d.procesados || 0) >= (d.total_dnis || 0) && (d.total_dnis || 0) > 0
                  return (
                    <div key={d.id} className="flex items-center justify-between bg-oratioo-light/30 rounded-lg px-3 py-1.5 border border-oratioo-border">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${completo ? 'bg-emerald-400' : d.estado === 'analizando' ? 'bg-purple-400 animate-pulse' : 'bg-amber-400'}`} />
                        <span className="text-[11px] text-oratioo-dark truncate max-w-[200px]">{d.nombre_archivo}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-oratioo-gray flex-shrink-0">
                        <span>{d.total_dnis || 0} DNIs</span>
                        <span>·</span>
                        <span className={completo ? 'text-emerald-600 font-medium' : d.estado === 'analizando' ? 'text-purple-600 font-medium' : 'text-amber-600'}>
                          {completo ? 'Completo' : d.estado === 'analizando' ? 'Analizando' : 'Pendiente'}
                        </span>
                        <button onClick={() => handleDeleteDocument(d)}
                          className="p-0.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
