'use client';

import { useState, useEffect, useCallback } from 'react';

type Ddi = {
  id: number;
  provincia: string;
  codigo_prov: string | null;
  prefijos: string[];
  ddi: string;
  outbound_id: string | null;
  campana: string | null;
  tipo_llamada: string | null;
  estado: string;
  comentarios: string | null;
};

type Resumen = { estado: string; n: number; con_uuid: number };
type Total = { total: number; provincias: number; con_uuid: number };

const ESTADOS = ['activo', 'spam', 'no_alta', 'pausado'];
const TIPOS = ['', 'manual', 'progresivo_cp', 'progresivo_base'];

const ESTADO_CLASE: Record<string, string> = {
  activo: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  spam: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  no_alta: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  pausado: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

function claseEstado(e: string) {
  return ESTADO_CLASE[e] || 'bg-gray-100 text-gray-600';
}

const FORM_VACIO = {
  id: 0, provincia: '', codigo_prov: '', prefijos: '', ddi: '',
  outbound_id: '', campana: '', tipo_llamada: '', estado: 'activo', comentarios: '',
};

export default function DdisPage() {
  const [ddis, setDdis] = useState<Ddi[]>([]);
  const [resumen, setResumen] = useState<Resumen[]>([]);
  const [total, setTotal] = useState<Total>({ total: 0, provincias: 0, con_uuid: 0 });
  const [loading, setLoading] = useState(true);
  const [fEstado, setFEstado] = useState('');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [msg, setMsg] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (fEstado) p.set('estado', fEstado);
    if (q) p.set('q', q);
    try {
      const r = await fetch(`/api/ddis?${p.toString()}`);
      const d = await r.json();
      if (r.ok) {
        setDdis(d.ddis || []);
        setResumen(d.resumen || []);
        setTotal(d.total || { total: 0, provincias: 0, con_uuid: 0 });
      } else {
        setMsg(d.error || 'Error al cargar');
      }
    } catch {
      setMsg('Error de red');
    }
    setLoading(false);
  }, [fEstado, q]);

  useEffect(() => {
    const t = setTimeout(cargar, 250);
    return () => clearTimeout(t);
  }, [cargar]);

  function abrirNuevo() {
    setForm({ ...FORM_VACIO });
    setEditando(false);
    setModal(true);
  }

  function abrirEditar(d: Ddi) {
    setForm({
      id: d.id,
      provincia: d.provincia || '',
      codigo_prov: d.codigo_prov || '',
      prefijos: (d.prefijos || []).join(', '),
      ddi: d.ddi || '',
      outbound_id: d.outbound_id || '',
      campana: d.campana || '',
      tipo_llamada: d.tipo_llamada || '',
      estado: d.estado || 'activo',
      comentarios: d.comentarios || '',
    });
    setEditando(true);
    setModal(true);
  }

  async function guardar() {
    if (!form.provincia || !form.ddi) {
      setMsg('Provincia y DDI son obligatorios');
      return;
    }
    setGuardando(true);
    const metodo = editando ? 'PATCH' : 'POST';
    const body: any = {
      provincia: form.provincia,
      codigo_prov: form.codigo_prov,
      prefijos: form.prefijos,
      ddi: form.ddi,
      outbound_id: form.outbound_id,
      campana: form.campana,
      tipo_llamada: form.tipo_llamada,
      estado: form.estado,
      comentarios: form.comentarios,
    };
    if (editando) body.id = form.id;
    try {
      const r = await fetch('/api/ddis', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (r.ok) {
        setModal(false);
        setMsg(editando ? 'DDI actualizado' : 'DDI creado');
        cargar();
      } else {
        setMsg(d.error || 'Error al guardar');
      }
    } catch {
      setMsg('Error de red');
    }
    setGuardando(false);
  }

  async function cambiarEstado(d: Ddi, estado: string) {
    try {
      const r = await fetch('/api/ddis', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: d.id, estado }),
      });
      if (r.ok) cargar();
      else setMsg('No se pudo cambiar el estado');
    } catch {
      setMsg('Error de red');
    }
  }

  async function eliminar(d: Ddi) {
    if (!confirm(`¿Eliminar el DDI ${d.ddi}?`)) return;
    try {
      const r = await fetch(`/api/ddis?id=${d.id}`, { method: 'DELETE' });
      if (r.ok) { setMsg('DDI eliminado'); cargar(); }
      else setMsg('No se pudo eliminar');
    } catch {
      setMsg('Error de red');
    }
  }

  const setF = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Gestión de DDIs</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Números de salida por provincia. El motor presenta un DDI activo de la provincia del cliente.
          </p>
        </div>
        <button onClick={abrirNuevo}
          className="bg-[#0a6ea9] hover:bg-[#085d8f] text-white text-sm px-4 py-2 rounded-lg transition-colors">
          + Nuevo DDI
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div className="bg-white dark:bg-[#1a1030] border border-gray-200 dark:border-white/10 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-800 dark:text-white">{total.total}</div>
          <div className="text-[11px] text-gray-500">DDIs · {total.provincias} provincias</div>
        </div>
        <div className="bg-white dark:bg-[#1a1030] border border-gray-200 dark:border-white/10 rounded-lg p-3">
          <div className="text-2xl font-bold text-[#0a6ea9]">{total.con_uuid}</div>
          <div className="text-[11px] text-gray-500">con outbound_id</div>
        </div>
        {resumen.map((r) => (
          <div key={r.estado} className="bg-white dark:bg-[#1a1030] border border-gray-200 dark:border-white/10 rounded-lg p-3">
            <div className="text-2xl font-bold text-gray-800 dark:text-white">{r.n}</div>
            <div className="text-[11px] text-gray-500 capitalize">{r.estado}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar DDI o provincia..."
          className="border border-gray-300 dark:border-white/10 dark:bg-[#1a1030] dark:text-white rounded-lg px-3 py-1.5 text-sm w-64" />
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value)}
          className="border border-gray-300 dark:border-white/10 dark:bg-[#1a1030] dark:text-white rounded-lg px-3 py-1.5 text-sm">
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-[#1a1030] border border-gray-200 dark:border-white/10 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-[11px] uppercase">
            <tr>
              <th className="text-left px-3 py-2">Provincia</th>
              <th className="text-left px-3 py-2">Prefijos</th>
              <th className="text-left px-3 py-2">DDI</th>
              <th className="text-left px-3 py-2">outbound_id</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-left px-3 py-2">Estado</th>
              <th className="text-right px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">Cargando...</td></tr>
            )}
            {!loading && ddis.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">Sin resultados</td></tr>
            )}
            {!loading && ddis.map((d) => (
              <tr key={d.id} className="text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                <td className="px-3 py-2">
                  <span className="text-gray-400 mr-1">{d.codigo_prov}</span>{d.provincia}
                </td>
                <td className="px-3 py-2 text-gray-500">{(d.prefijos || []).join(', ')}</td>
                <td className="px-3 py-2 font-mono">{d.ddi}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-400">{d.outbound_id || '—'}</td>
                <td className="px-3 py-2 text-xs">{d.tipo_llamada || '—'}</td>
                <td className="px-3 py-2">
                  <select value={d.estado} onChange={(e) => cambiarEstado(d, e.target.value)}
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer ${claseEstado(d.estado)}`}>
                    {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => abrirEditar(d)}
                    className="text-[#0a6ea9] hover:underline text-xs mr-3">Editar</button>
                  <button onClick={() => eliminar(d)}
                    className="text-red-500 hover:underline text-xs">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {msg && (
        <div onClick={() => setMsg('')}
          className="fixed bottom-4 right-4 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg cursor-pointer">
          {msg}
        </div>
      )}

      {/* Modal alta/edición */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setModal(false)}>
          <div className="bg-white dark:bg-[#1a1030] rounded-xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-3">
              {editando ? 'Editar DDI' : 'Nuevo DDI'}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-gray-500 col-span-1">
                Provincia *
                <input value={form.provincia} onChange={(e) => setF('provincia', e.target.value)}
                  className="mt-1 w-full border border-gray-300 dark:border-white/10 dark:bg-[#0f0a1f] dark:text-white rounded px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-gray-500 col-span-1">
                Código provincia (2 díg)
                <input value={form.codigo_prov} onChange={(e) => setF('codigo_prov', e.target.value)}
                  className="mt-1 w-full border border-gray-300 dark:border-white/10 dark:bg-[#0f0a1f] dark:text-white rounded px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-gray-500 col-span-2">
                Prefijos (separados por coma)
                <input value={form.prefijos} onChange={(e) => setF('prefijos', e.target.value)}
                  placeholder="91, 81"
                  className="mt-1 w-full border border-gray-300 dark:border-white/10 dark:bg-[#0f0a1f] dark:text-white rounded px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-gray-500 col-span-1">
                DDI *
                <input value={form.ddi} onChange={(e) => setF('ddi', e.target.value)}
                  className="mt-1 w-full border border-gray-300 dark:border-white/10 dark:bg-[#0f0a1f] dark:text-white rounded px-2 py-1.5 text-sm font-mono" />
              </label>
              <label className="text-xs text-gray-500 col-span-1">
                outbound_id (UUID VPBX)
                <input value={form.outbound_id} onChange={(e) => setF('outbound_id', e.target.value)}
                  className="mt-1 w-full border border-gray-300 dark:border-white/10 dark:bg-[#0f0a1f] dark:text-white rounded px-2 py-1.5 text-sm font-mono" />
              </label>
              <label className="text-xs text-gray-500 col-span-1">
                Tipo de llamada
                <select value={form.tipo_llamada} onChange={(e) => setF('tipo_llamada', e.target.value)}
                  className="mt-1 w-full border border-gray-300 dark:border-white/10 dark:bg-[#0f0a1f] dark:text-white rounded px-2 py-1.5 text-sm">
                  {TIPOS.map((t) => <option key={t} value={t}>{t || '—'}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500 col-span-1">
                Estado
                <select value={form.estado} onChange={(e) => setF('estado', e.target.value)}
                  className="mt-1 w-full border border-gray-300 dark:border-white/10 dark:bg-[#0f0a1f] dark:text-white rounded px-2 py-1.5 text-sm">
                  {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500 col-span-2">
                Campaña
                <input value={form.campana} onChange={(e) => setF('campana', e.target.value)}
                  className="mt-1 w-full border border-gray-300 dark:border-white/10 dark:bg-[#0f0a1f] dark:text-white rounded px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-gray-500 col-span-2">
                Comentarios
                <textarea value={form.comentarios} onChange={(e) => setF('comentarios', e.target.value)}
                  className="mt-1 w-full border border-gray-300 dark:border-white/10 dark:bg-[#0f0a1f] dark:text-white rounded px-2 py-1.5 text-sm" rows={2} />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setModal(false)}
                className="text-sm px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                className="bg-[#0a6ea9] hover:bg-[#085d8f] text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
