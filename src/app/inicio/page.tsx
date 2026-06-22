/**
 * app/inicio/page.tsx — Splash screen + Config de proyectos (admin)
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ArrowRight,
  Settings,
  X,
  Globe,
  Plus,
  Play,
  Pause,
  Edit3,
  Save,
  Trash2,
} from "lucide-react";
import { useProject } from "@/lib/project-context";
import { toast } from "@/components/shared/Toast";
import OratiooLogo from "@/components/shared/OratiooLogo";
import AnunciosModal from "@/components/shared/AnunciosModal";

type ProyectoCard = {
  id: number;
  nombre: string;
  nombre_visible: string;
  activo?: boolean;
  config?: any;
};
type Stats = {
  proyecto_id: number;
  total: number;
  pendientes: number;
  completados: number;
};

const PROYECTO_LOGOS: Record<string, string> = {};

// Campos predefinidos por tipo de proyecto
const PLANTILLAS_CAMPOS: Record<string, string[]> = {
  orange: [
    "cima",
    "tiene_renove",
    "renove_variante",
    "lineas",
    "paquete",
    "tv",
    "permanencia",
    "consumo",
    "venta_plazos",
    "campanas_extra",
  ],
  energia: [
    "cups_luz",
    "cups_gas",
    "nombre_titular",
    "documento_titular",
    "direccion_suministro",
    "codigo_postal",
    "municipio",
    "provincia",
    "comercializadora",
    "tarifa",
    "potencia_p1",
    "potencia_p2",
    "consumo_12m",
    "consumo_last_year",
    "telefono_voz",
  ],
};

export default function InicioPage() {
  const { proyectos: ctxProjects, setProyecto } = useProject();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [modalProyecto, setModalProyecto] = useState<ProyectoCard | null>(null);

  const [showConfig, setShowConfig] = useState(false);
  const [adminProjects, setAdminProjects] = useState<ProyectoCard[]>([]);
  const [adminStats, setAdminStats] = useState<Record<number, Stats>>({});
  const [configLoading, setConfigLoading] = useState(false);
  const [editingProject, setEditingProject] = useState<ProyectoCard | null>(
    null,
  );

  // Form: nuevo proyecto
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState({
    nombre: "",
    nombre_visible: "",
    plantilla: "orange",
    logo_url: "",
  });

  // Form: editar proyecto
  const [editForm, setEditForm] = useState<any>({});
  const [editSaving, setEditSaving] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");

  useEffect(() => {
    if (ctxProjects.length > 0) {
      fetch("/api/auth/session")
        .then((r) => r.json())
        .then((s) => {
          setUserRole(s?.user?.role || "");
        })
        .catch(() => {});
      const t = setTimeout(() => setReady(true), 400);
      return () => clearTimeout(t);
    }
  }, [ctxProjects]);

  const entrar = (p: {
    id: number;
    nombre: string;
    nombre_visible: string;
  }) => {
    const proy = ctxProjects.find((x) => x.id === p.id);
    if (proy) {
      // Guardar proyecto en contexto y mostrar modal de anuncios
      setProyecto(proy);
      setModalProyecto(proy);
    }
  };

  const onModalClose = () => {
    setModalProyecto(null);
    // Navegar al dashboard
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        const rol = s?.user?.role || "asesor";
        const dest: Record<string, string> = {
          jefe_area: "/jefe",
          desarrollador: "/jefe",
          supervisor: "/supervisor",
          asesor: "/asesor",
          back_office: "/backoffice",
          it: "/admin",
          auditor_calidad: "/calidad",
        };
        router.push(dest[rol] || "/inicio");
      })
      .catch(() => router.push("/inicio"));
  };

  const loadAdminProjects = async () => {
    setConfigLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        fetch("/api/proyectos"),
        fetch("/api/proyectos/stats"),
      ]);
      const projs = await pRes.json();
      setAdminProjects(projs);
      const sData = await sRes.json();
      const map: Record<number, Stats> = {};
      for (const s of sData) map[s.proyecto_id] = s;
      setAdminStats(map);
    } catch {
      /* */
    }
    setConfigLoading(false);
  };

  const openConfig = () => {
    setShowConfig(true);
    loadAdminProjects();
  };
  const closeConfig = () => {
    setShowConfig(false);
    setEditingProject(null);
  };

  const toggleActivo = async (p: ProyectoCard) => {
    const current = p.activo !== false;
    try {
      await fetch("/api/proyectos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, activo: !current }),
      });
      setAdminProjects((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, activo: !current } : x)),
      );
    } catch {
      toast.error("Error");
    }
  };

  const deleteProject = async (p: ProyectoCard) => {
    if (
      !confirm(
        `¿Eliminar "${p.nombre_visible}"? Esta acción no se puede deshacer.`,
      )
    )
      return;
    try {
      const res = await fetch("/api/proyectos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id }),
      });
      if (res.ok) {
        toast.success("Proyecto eliminado");
        setAdminProjects((prev) => prev.filter((x) => x.id !== p.id));
      } else {
        toast.error("Error al eliminar");
      }
    } catch {
      toast.error("Error");
    }
  };

  const crearProyecto = async () => {
    if (!newForm.nombre || !newForm.nombre_visible) return;
    try {
      const campos = PLANTILLAS_CAMPOS[newForm.plantilla] || [];
      const config = {
        logo_url: newForm.logo_url,
        campos_lead: campos,
        meta_ventas_mes: 20,
        meta_contactos_mes: 200,
        cooldown_horas: 48,
        max_intentos: 5,
        dias_liberacion: 3,
      };
      await fetch("/api/proyectos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: newForm.nombre,
          nombre_visible: newForm.nombre_visible,
          activo: true,
          config,
        }),
      });
      toast.success("Proyecto creado");
      setNewForm({
        nombre: "",
        nombre_visible: "",
        plantilla: "orange",
        logo_url: "",
      });
      setShowNewForm(false);
      loadAdminProjects();
    } catch {
      toast.error("Error al crear proyecto");
    }
  };

  const openEdit = (p: ProyectoCard) => {
    const config = p.config || {};
    setEditForm({
      id: p.id,
      nombre: p.nombre,
      nombre_visible: p.nombre_visible,
      logo_url: config.logo_url || "",
      campos_lead: config.campos_lead || [],
      meta_ventas_mes: config.meta_ventas_mes || 20,
      meta_contactos_mes: config.meta_contactos_mes || 200,
      cooldown_horas: config.cooldown_horas || 48,
      max_intentos: config.max_intentos || 5,
      dias_liberacion: config.dias_liberacion || 3,
    });
    setEditingProject(p);
  };

  const saveEdit = async () => {
    setEditSaving(true);
    try {
      const config = {
        logo_url: editForm.logo_url,
        campos_lead: editForm.campos_lead,
        meta_ventas_mes: editForm.meta_ventas_mes,
        meta_contactos_mes: editForm.meta_contactos_mes,
        cooldown_horas: editForm.cooldown_horas,
        max_intentos: editForm.max_intentos,
        dias_liberacion: editForm.dias_liberacion,
      };
      await fetch("/api/proyectos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editForm.id,
          nombre_visible: editForm.nombre_visible,
          config,
        }),
      });
      toast.success("Proyecto actualizado");
      setEditingProject(null);
      loadAdminProjects();
    } catch {
      toast.error("Error al guardar");
    }
    setEditSaving(false);
  };

  const addField = () => {
    if (!newFieldName.trim()) return;
    const slug = newFieldName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_");
    if (!slug) return;
    if (editForm.campos_lead.includes(slug)) {
      toast.error("Campo ya existe");
      return;
    }
    setEditForm({ ...editForm, campos_lead: [...editForm.campos_lead, slug] });
    setNewFieldName("");
  };

  const removeField = (field: string) => {
    setEditForm({
      ...editForm,
      campos_lead: editForm.campos_lead.filter((f: string) => f !== field),
    });
  };

  const fieldLabel = (slug: string) =>
    slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#481163] to-[#2d0a40] flex flex-col items-center justify-center p-8 relative">
      {/* Boton config */}
      {["jefe_area", "desarrollador"].includes(userRole) && (
        <button
          onClick={openConfig}
          className="absolute top-4 right-4 p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white/40 hover:text-white/80 transition-all"
          title="Configurar proyectos"
        >
          <Settings size={20} />
        </button>
      )}

      <div
        className={`transition-all duration-700 ${ready ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}
      >
        <OratiooLogo className="w-98 h-14 mx-auto mb-0" color="white" />
        <p className="text-sm text-white/50 text-center mb-12">
          Selecciona un proyecto
        </p>
      </div>

      <div
        className={`flex gap-6 transition-all duration-700 delay-200 ${ready ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      >
        {ctxProjects.filter((p) => p.activo).length === 0 ? (
          <Loader2 size={24} className="animate-spin text-white/50" />
        ) : (
          ctxProjects
            .filter((p) => p.activo)
            .map((p) => {
              const logoUrl = (p as any).config?.logo_url || "";
              return (
                <button
                  key={p.id}
                  onClick={() => entrar(p)}
                  className="group relative w-56 h-64 rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 hover:border-white/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/30 flex flex-col items-center justify-center gap-6 "
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={p.nombre_visible}
                      className="max-h-16 max-w-[150px] object-contain opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                      onError={(e: any) => {
                        e.target.style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="text-white/20 text-6xl font-bold">
                      {p.nombre_visible[0]}
                    </span>
                  )}
                  <span className="text-white/60 text-base font-medium group-hover:text-white transition-colors">
                    {p.nombre_visible}
                  </span>
                  <ArrowRight
                    size={16}
                    className="text-white/10 group-hover:text-white/70 group-hover:translate-x-1 transition-all absolute bottom-4 right-4"
                  />
                </button>
              );
            })
        )}
      </div>

      {/* ── Config Overlay ── */}
      {showConfig && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-y-auto m-4 animate-scale-in">
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe size={20} className="text-[#0a6ea9]" /> Configuración de
                Proyectos
              </h2>
              <button
                onClick={closeConfig}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* ── Vista: Lista de proyectos ── */}
              {!editingProject && (
                <>
                  {!showNewForm ? (
                    <button
                      onClick={() => setShowNewForm(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-500 hover:border-[#0a6ea9] hover:text-[#0a6ea9] transition-colors"
                    >
                      <Plus size={16} /> Nuevo Proyecto
                    </button>
                  ) : (
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          placeholder="Slug (ej: energia)"
                          value={newForm.nombre}
                          onChange={(e) =>
                            setNewForm({ ...newForm, nombre: e.target.value })
                          }
                          className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 flex-1"
                        />
                        <input
                          placeholder="Nombre visible"
                          value={newForm.nombre_visible}
                          onChange={(e) =>
                            setNewForm({
                              ...newForm,
                              nombre_visible: e.target.value,
                            })
                          }
                          className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 flex-1"
                        />
                      </div>
                      <input
                        placeholder="Logo URL (opcional, ej: https://...)"
                        value={newForm.logo_url}
                        onChange={(e) =>
                          setNewForm({ ...newForm, logo_url: e.target.value })
                        }
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 w-full"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">
                          Plantilla de campos:
                        </span>
                        <select
                          value={newForm.plantilla}
                          onChange={(e) =>
                            setNewForm({
                              ...newForm,
                              plantilla: e.target.value,
                            })
                          }
                          className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800"
                        >
                          <option value="orange">Orange (telecom)</option>
                          <option value="energia">Energía (luz/gas)</option>
                        </select>
                        <button
                          onClick={crearProyecto}
                          className="btn-primary text-sm px-4 py-1.5 ml-auto"
                        >
                          Crear
                        </button>
                        <button
                          onClick={() => setShowNewForm(false)}
                          className="text-sm text-slate-400 hover:text-slate-600"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {configLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2
                        size={32}
                        className="animate-spin text-slate-300"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      {adminProjects.map((p) => {
                        const st = adminStats[p.id] || {
                          total: 0,
                          pendientes: 0,
                          completados: 0,
                        };
                        const campos = (p.config?.campos_lead || []).length;
                        return (
                          <div
                            key={p.id}
                            className={`rounded-xl border p-5 ${p.activo ? "border-slate-200 dark:border-slate-700" : "border-slate-100 dark:border-slate-800 opacity-50"}`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <Globe
                                size={20}
                                className={
                                  p.activo ? "text-[#481163]" : "text-slate-400"
                                }
                              />
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openEdit(p)}
                                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600"
                                  title="Editar"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button
                                  onClick={() => toggleActivo(p)}
                                  className={`p-1.5 rounded-lg ${p.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                                >
                                  {p.activo ? (
                                    <Pause size={14} />
                                  ) : (
                                    <Play size={14} />
                                  )}
                                </button>
                                <button
                                  onClick={() => deleteProject(p)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                                  title="Eliminar"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            <h3 className="text-sm font-semibold">
                              {p.nombre_visible}
                            </h3>
                            <p className="text-[10px] text-slate-400 mb-3">
                              {p.nombre} · {campos} campos
                            </p>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <p className="text-lg font-bold">{st.total}</p>
                                <p className="text-[9px] text-slate-400">
                                  Total
                                </p>
                              </div>
                              <div>
                                <p className="text-lg font-bold text-amber-600">
                                  {st.pendientes}
                                </p>
                                <p className="text-[9px] text-slate-400">
                                  Pend.
                                </p>
                              </div>
                              <div>
                                <p className="text-lg font-bold text-emerald-600">
                                  {st.completados}
                                </p>
                                <p className="text-[9px] text-slate-400">
                                  Comp.
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* ── Vista: Editar proyecto ── */}
              {editingProject && (
                <div className="space-y-6 animate-slide-up">
                  <button
                    onClick={() => setEditingProject(null)}
                    className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1"
                  >
                    ← Volver a proyectos
                  </button>

                  {/* Info básica */}
                  <div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          Slug
                        </label>
                        <input
                          value={editForm.nombre}
                          disabled
                          className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700/50 text-slate-400 mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          Nombre visible
                        </label>
                        <input
                          value={editForm.nombre_visible}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              nombre_visible: e.target.value,
                            })
                          }
                          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 mt-1"
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Logo URL (opcional)
                      </label>
                      <div className="flex gap-3 mt-1">
                        <input
                          value={editForm.logo_url}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              logo_url: e.target.value,
                            })
                          }
                          placeholder="https://..."
                          className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                        />
                        {editForm.logo_url && (
                          <div className="w-24 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center p-1">
                            <img
                              src={editForm.logo_url}
                              alt="Preview"
                              className="max-h-full max-w-full object-contain"
                              onError={(e: any) => {
                                e.target.style.display = "none";
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Campos del lead */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Campos del lead
                    </label>
                    <p className="text-[10px] text-slate-400 mb-2">
                      Define qué campos se muestran en el Power Dialer y la
                      ficha del cliente
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {(editForm.campos_lead || []).map((field: string) => (
                        <span
                          key={field}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300"
                        >
                          {fieldLabel(field)}
                          <button
                            onClick={() => removeField(field)}
                            className="hover:text-red-500"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        placeholder="Nombre del campo (ej: cups_luz)"
                        value={newFieldName}
                        onChange={(e) => setNewFieldName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addField()}
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-800 flex-1"
                      />
                      <button
                        onClick={addField}
                        className="btn-outline text-xs px-3 py-1.5"
                      >
                        Agregar
                      </button>
                    </div>
                  </div>

                  {/* Metas */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Metas mensuales
                    </label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <label className="text-[10px] text-slate-400">
                          Ventas/mes
                        </label>
                        <input
                          type="number"
                          value={editForm.meta_ventas_mes}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              meta_ventas_mes: +e.target.value,
                            })
                          }
                          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">
                          Contactos/mes
                        </label>
                        <input
                          type="number"
                          value={editForm.meta_contactos_mes}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              meta_contactos_mes: +e.target.value,
                            })
                          }
                          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Operativo */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Parámetros operativos
                    </label>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      <div>
                        <label className="text-[10px] text-slate-400">
                          Cooldown (horas)
                        </label>
                        <input
                          type="number"
                          value={editForm.cooldown_horas}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              cooldown_horas: +e.target.value,
                            })
                          }
                          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">
                          Máx intentos
                        </label>
                        <input
                          type="number"
                          value={editForm.max_intentos}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              max_intentos: +e.target.value,
                            })
                          }
                          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">
                          Días liberación
                        </label>
                        <input
                          type="number"
                          value={editForm.dias_liberacion}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              dias_liberacion: +e.target.value,
                            })
                          }
                          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={saveEdit}
                      disabled={editSaving}
                      className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5"
                    >
                      {editSaving ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}{" "}
                      Guardar cambios
                    </button>
                    <button
                      onClick={() => setEditingProject(null)}
                      className="text-sm text-slate-400 hover:text-slate-600"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    {/* Modal de anuncios al entrar al proyecto */}
    {modalProyecto && (
      <AnunciosModal
        proyectoId={modalProyecto.id}
        onClose={onModalClose}
      />
    )}
  </div>
  );
}
