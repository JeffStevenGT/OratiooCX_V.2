import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit3, Key, X, Loader2, Users,
  Shield, Globe } from 'lucide-react'
import { supabase, TABLA_PERFILES, TABLA_EQUIPOS, ROLES } from '../supabaseClient'

const ROL_LABELS = {
  asesor: 'Asesor',
  supervisor: 'Supervisor',
  it: 'IT',
  back_office: 'Back Office',
  jefe_area: 'Jefe de Area',
  ceo: 'CEO',
  desarrollador: 'Desarrollador',
}

const ROL_COLORS = {
  asesor: 'bg-blue-100 text-blue-700',
  supervisor: 'bg-amber-100 text-amber-700',
  it: 'bg-purple-100 text-purple-700',
  back_office: 'bg-slate-100 text-slate-700',
  jefe_area: 'bg-emerald-100 text-emerald-700',
  ceo: 'bg-indigo-100 text-indigo-700',
  desarrollador: 'bg-red-100 text-red-700',
}

export default function AdminUsers() {
  const [perfiles, setPerfiles] = useState([])
  const [equipos, setEquipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ email: '', password: '', nombre: '', rol: 'asesor', pais: 'PE', proxy_asignado: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const session = JSON.parse(localStorage.getItem('oratioo_session') || '{}')
  const myRol = session.rol
  const myPais = session.pais || 'PE'
  const isSupervisor = myRol === 'supervisor'
  const canManage = ['jefe_area', 'desarrollador'].includes(myRol)
  const [myEquipoId, setMyEquipoId] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    const [p, e] = await Promise.all([
      supabase.from(TABLA_PERFILES).select('*').order('created_at', { ascending: false }),
      supabase.from(TABLA_EQUIPOS).select('*'),
    ])
    if (p.data) setPerfiles(p.data)
    if (e.data) setEquipos(e.data)

    if (isSupervisor && session.userId) {
      const { data: myProfile } = await supabase.from(TABLA_PERFILES).select('equipo_id').eq('user_id', session.userId).single()
      if (myProfile) setMyEquipoId(myProfile.equipo_id)
    }

    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm({ email: '', password: '', nombre: '', rol: isSupervisor ? 'asesor' : 'asesor', pais: myPais, proxy_asignado: '' })
    setError('')
    setShowModal(true)
  }

  const openEdit = (p) => {
    setEditingId(p.id)
    setForm({ email: p.username, password: '', nombre: p.nombre, rol: p.rol, pais: p.pais, proxy_asignado: p.proxy_asignado || '' })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.email || !form.nombre) { setError('Email y nombre son requeridos'); return }
    setSaving(true)
    setError('')

    try {
      if (editingId) {
        const updateData = {
          username: form.email,
          nombre: form.nombre,
          rol: form.rol,
          pais: form.pais,
          ...(isSupervisor && myEquipoId ? { equipo_id: myEquipoId } : {}),
        }
        await supabase.from(TABLA_PERFILES).update(updateData).eq('id', editingId)
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password || 'Temp1234!',
        })
        if (signUpError) throw signUpError

        await new Promise(r => setTimeout(r, 1000))

        const { data: perfilesNuevos } = await supabase.from(TABLA_PERFILES)
          .select('id').eq('username', form.email).order('created_at', { ascending: false }).limit(1)

        if (perfilesNuevos?.[0]) {
          await supabase.from(TABLA_PERFILES).update({
            nombre: form.nombre,
            rol: form.rol,
            pais: form.pais,
            ...(isSupervisor && myEquipoId ? { equipo_id: myEquipoId } : {}),
          }).eq('id', perfilesNuevos[0].id)
        }
      }

      setShowModal(false)
      fetchData()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Eliminar este usuario?')) return
    await supabase.from(TABLA_PERFILES).update({ activo: false }).eq('id', id)
    fetchData()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-[#0a6ea9]" /></div>
  }

  const users = isSupervisor
    ? perfiles.filter(p => p.rol === 'asesor' && p.equipo_id === myEquipoId)
    : perfiles

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a1030] flex items-center gap-2"><Shield size={22} className="text-oratioo-purple" /> Usuarios</h1>
          <p className="text-sm text-[#7c757c] mt-1">{isSupervisor ? 'Asesores de tu equipo' : `${users.length} usuarios registrados`}</p>
        </div>
        {(canManage || isSupervisor) && (
          <button onClick={openCreate} className="bg-[#0a6ea9] hover:bg-[#085d8f] text-white flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-all">
            <Plus size={16} /> {isSupervisor ? 'Crear asesor' : 'Nuevo usuario'}
          </button>
        )}
      </div>

      {/* Equipos */}
      {canManage && equipos.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#1a1030]">Equipos ({equipos.length})</h2>
            <button onClick={async () => {
              const nombre = prompt('Nombre del nuevo equipo:')
              if (!nombre) return
              const pais = prompt('Pais (PE o ES):', 'PE')?.toUpperCase()
              if (!pais || !['PE','ES'].includes(pais)) return
              await supabase.from(TABLA_EQUIPOS).insert({ nombre, pais })
              fetchData()
            }} className="text-xs bg-[#0a6ea9] hover:bg-[#085d8f] text-white px-3 py-1.5 rounded-lg transition-all">
              + Nuevo equipo
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {equipos.map(eq => (
              <span key={eq.id} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs bg-white border border-[#e8dce6] text-[#1a1030]">
                {eq.nombre} <span className="text-[#7c757c]">({eq.pais})</span>
                <button onClick={async () => {
                  if (!confirm('Eliminar equipo ' + eq.nombre + '?')) return
                  await supabase.from(TABLA_EQUIPOS).delete().eq('id', eq.id)
                  fetchData()
                }} className="text-[#7c757c] hover:text-red-500 ml-1">x</button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e8dce6]">
                <th className="table-header px-4 py-3">Usuario</th>
                <th className="table-header px-4 py-3">Nombre</th>
                <th className="table-header px-4 py-3">Rol</th>
                <th className="table-header px-4 py-3">Pais</th>
                <th className="table-header px-4 py-3">Proxy asignado</th>
                <th className="table-header px-4 py-3">Estado</th>
                {((canManage || isSupervisor)) && <th className="table-header px-4 py-3 w-24">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12">
                  <Users size={32} className="text-[#7c757c] mx-auto mb-2" />
                  <p className="text-[#7c757c] text-sm">No hay usuarios registrados</p>
                </td></tr>
              ) : users.map((p) => (
                <tr key={p.id} className="border-b border-[#e8dce6] hover:bg-[#f5ebf3]/50">
                  <td className="table-cell font-mono text-xs">{p.username}</td>
                  <td className="table-cell font-medium">{p.nombre}</td>
                  <td className="table-cell">
                    <span className={`rounded-full px-2 py-1 text-xs ${ROL_COLORS[p.rol] || 'bg-gray-100 text-gray-600'}`}>
                      {ROL_LABELS[p.rol] || p.rol}
                    </span>
                  </td>
                  <td className="table-cell text-xs">{p.pais === 'PE' ? 'Peru' : 'Espana'}</td>
                  <td className="table-cell">
                    {p.proxy_asignado ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-purple-50 text-purple-700 border border-purple-200">
                        <Globe size={10} /> {p.proxy_asignado.split(':')[0]}
                      </span>
                    ) : (
                      <span className="text-xs text-[#7c757c]">Sin proxy</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <span className={`rounded-full px-2 py-1 text-xs ${p.activo !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {p.activo !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {((canManage || isSupervisor)) && (
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-[#f5ebf3] text-[#7c757c] hover:text-[#0a6ea9]"><Edit3 size={14} /></button>
                        <button onClick={async () => {
                          const proxy = prompt('IP del proxy (formato Webshare: ip:puerto:user:pass):', p.proxy_asignado || '')
                          if (proxy === null) return
                          if (proxy.trim()) {
                            await supabase.from('perfiles').update({ proxy_asignado: proxy.trim() }).eq('id', p.id)
                          } else {
                            await supabase.from('perfiles').update({ proxy_asignado: '' }).eq('id', p.id)
                          }
                          fetchData()
                        }} className="p-1.5 rounded hover:bg-[#1d366b] text-[#7c757c] hover:text-[#0a6ea9]" title="Asignar proxy"><Globe size={14} /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded hover:bg-red-50 text-[#7c757c] hover:text-red-600"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#1a1030]">{editingId ? 'Editar usuario' : isSupervisor ? 'Crear asesor' : 'Nuevo usuario'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-[#f5ebf3]"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#7c757c] mb-1">Email / Usuario</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-[#e8dce6] rounded-lg px-3 py-2 text-sm" placeholder="usuario@oratioo.com" />
              </div>
              <div>
                <label className="block text-xs text-[#7c757c] mb-1">{editingId ? 'Nueva contrasena (dejar vacio para no cambiar)' : 'Contrasena'}</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full border border-[#e8dce6] rounded-lg px-3 py-2 text-sm" placeholder={editingId ? '********' : 'Minimo 8 caracteres'} />
              </div>
              <div>
                <label className="block text-xs text-[#7c757c] mb-1">Nombre</label>
                <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="w-full border border-[#e8dce6] rounded-lg px-3 py-2 text-sm" placeholder="Ana Garcia" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#7c757c] mb-1">Rol</label>
                  <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}
                    disabled={isSupervisor}
                    className="w-full border border-[#e8dce6] rounded-lg px-3 py-2 text-sm disabled:bg-[#f5ebf3]">
                    {isSupervisor
                      ? <option value="asesor">Asesor</option>
                      : Object.entries(ROL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)
                    }
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#7c757c] mb-1">Pais</label>
                  <select value={form.pais} onChange={e => setForm({ ...form, pais: e.target.value })}
                    disabled={isSupervisor}
                    className="w-full border border-[#e8dce6] rounded-lg px-3 py-2 text-sm disabled:bg-[#f5ebf3]">
                    {isSupervisor
                      ? <option value={myPais}>{myPais === 'PE' ? 'Peru' : 'Espana'}</option>
                      : <><option value="PE">Peru</option><option value="ES">Espana</option></>
                    }
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#7c757c] mb-1">Proxy asignado (para Abrir Orange)</label>
                <select value={form.proxy_asignado} onChange={e => setForm({ ...form, proxy_asignado: e.target.value })}
                  className="w-full border border-[#e8dce6] rounded-lg px-3 py-2 text-sm">
                  {todosProxies.map((p, i) => <option key={i} value={p.value}>{p.label}</option>)}
                </select>
                <p className="text-[10px] text-[#7c757c] mt-1">Los proxies se configuran en el archivo proxies.txt del servidor</p>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 border border-[#e8dce6] rounded-lg py-2 text-sm">Cancelar</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-[#0a6ea9] hover:bg-[#085d8f] text-white rounded-lg py-2 text-sm disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : editingId ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
