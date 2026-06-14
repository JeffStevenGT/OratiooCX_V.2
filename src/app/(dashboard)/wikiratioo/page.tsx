/**
 * app/(dashboard)/wikiratioo/page.tsx — Wikiratioo: Formacion
 */

'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Play, FileText, CheckCircle2, ChevronRight, Award, Search, Star, Clock, Tag, ExternalLink } from 'lucide-react';
import { toast } from '@/components/shared/Toast';

type Modulo = {
  id: number; titulo: string; tipo: 'video' | 'guia'; duracion: string; descripcion: string;
  contenido: string[]; categoria: string; mediaUrl?: string;
};

const MODULOS: Modulo[] = [
  {
    id: 1, titulo: 'Bienvenida a Oratioo', tipo: 'video', duracion: '5 min', categoria: 'Onboarding',
    mediaUrl: 'https://youtu.be/B4VM-7wsvWg',
    descripcion: 'Conoce la plataforma, tus herramientas y como empezar a vender.',
    contenido: [
      'Que es Oratioo CX y para que sirve',
      'Navegacion por la plataforma: sidebar, dashboards, accesos rapidos',
      'Roles del sistema: asesor, supervisor, jefe, backoffice, QA',
      'Como acceder a tus leads asignados',
      'Primeros pasos: configurar tu perfil y cambiar contrasena',
    ],
  },
  {
    id: 2, titulo: 'Power Dialer: Como llamar', tipo: 'guia', duracion: '8 min', categoria: 'Ventas',
    mediaUrl: 'https://youtu.be/TkN2i-_4N4g',
    descripcion: 'Aprende a usar el discador, gestionar leads y tipificar resultados.',
    contenido: [
      'Que es el Power Dialer y como funciona',
      'Navegacion entre leads: anterior, siguiente, primero, ultimo',
      'Lineas del cliente: cuales llamar primero (principal, CIMA, Renove)',
      'Como agregar un numero nuevo si el cliente tiene otro telefono',
      'Tipificacion post-llamada: contactado, no contesta, buzon, equivocado',
      'Sub-estados: Proceso de Portabilidad y Volver a Llamar',
    ],
  },
  {
    id: 3, titulo: 'Entendiendo CIMA y Renove', tipo: 'guia', duracion: '10 min', categoria: 'Producto',
    mediaUrl: 'https://www.youtube.com/live/LQqv4M_NtNc',
    descripcion: 'Que significan los indicadores CIMA y Renove. Como usarlos para vender mas.',
    contenido: [
      'Que es CIMA: cliente identificado de maximo atencion',
      'Como detectar un cliente CIMA en la plataforma',
      'Que es Renove: oferta de renovacion disponible',
      'Variantes de Renove: mixto, al mejor precio, con descuento, maximo descuento',
      'Que significa cuando un cliente tiene CIMA+Renove (oro puro)',
      'Estrategia de llamada segun el perfil del cliente',
    ],
  },
  {
    id: 4, titulo: 'Pipeline Comercial', tipo: 'video', duracion: '7 min', categoria: 'Ventas',
    descripcion: 'El ciclo de ventas: desde el primer contacto hasta la activacion.',
    contenido: [
      'Estados del pipeline: pendiente, contactado, interesado, negociacion, venta',
      'Que significa cada estado y cuando usarlo',
      'Diferencia entre No Interesa y No Contesta',
      'El ciclo de cooldown: cada 48h maximo, no molestar al cliente',
      'Cuando un lead se cierra automaticamente (5 intentos sin contacto)',
      'La importancia de registrar notas en cada llamada',
    ],
  },
  {
    id: 5, titulo: 'Productos Orange', tipo: 'guia', duracion: '15 min', categoria: 'Producto',
    descripcion: 'Paquetes, fibra, movil, TV. Todo lo que puedes ofrecer.',
    contenido: [
      'Fibra optica: velocidades disponibles (300Mb, 600Mb, 1Gb)',
      'Movil: planes con datos ilimitados',
      'TV: canales y paquetes adicionales',
      'Paquetes combinados: fibra + movil + TV',
      'Precios orientativos y como presentarlos',
      'Como comparar con la competencia sin hablar mal de ellos',
    ],
  },
  {
    id: 6, titulo: 'Objeciones Frecuentes', tipo: 'video', duracion: '12 min', categoria: 'Ventas',
    descripcion: 'Como responder a "ya tengo", "es muy caro", "llamame despues".',
    contenido: [
      'Objecion: "Ya tengo otro operador" — respuesta sugerida',
      'Objecion: "Es muy caro" — como destacar el valor, no el precio',
      'Objecion: "No me interesa" — tecnicas de cierre suave',
      'Objecion: "Llamame en otro momento" — como programar callback',
      'Cuando insistir y cuando soltar: respetar al cliente',
      'Tecnica: preguntas abiertas vs cerradas',
    ],
  },
  {
    id: 7, titulo: 'Calidad de Llamada (QA)', tipo: 'guia', duracion: '10 min', categoria: 'Calidad',
    descripcion: 'Los 5 criterios que evalua el auditor de calidad y como mejorar tu puntaje.',
    contenido: [
      'Speech / Saludo: como presentarte profesionalmente',
      'Manejo de objeciones: no discutir, entender y proponer',
      'Tecnica de cierre: como cerrar una venta sin presionar',
      'Compliance / RGPD: lo que puedes y no puedes decir',
      'Empatia / Tono: la importancia de escuchar activamente',
      'Como subir tu puntaje QA de 15 a 20+',
    ],
  },
  {
    id: 8, titulo: 'WhatsApp para Asesores', tipo: 'guia', duracion: '5 min', categoria: 'Herramientas',
    descripcion: 'Como usar las plantillas de WhatsApp sin salir del Power Dialer.',
    contenido: [
      'Donde encontrar el boton de WhatsApp en el Power Dialer',
      'Plantillas disponibles: Bienvenida, Info Renove, Seguimiento',
      'Como elegir la plantilla correcta segun el momento',
      'Que NO hacer: nunca escribir mensajes libres, solo plantillas',
      'El supervisor configura las plantillas, tu solo las usas',
    ],
  },
];

const CATEGORIAS = [...new Set(MODULOS.map(m => m.categoria))];

export default function WikiratiooPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [completados, setCompletados] = useState<Set<number>>(new Set());
  const [userId, setUserId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(s => {
      const uid = s?.user?.id || 'anon';
      setUserId(String(uid));
      try { setCompletados(new Set(JSON.parse(localStorage.getItem(`wikiratioo_completados_${uid}`) || '[]'))); } catch {}
    }).catch(() => {});
  }, []);

  const toggleCompletado = (id: number) => {
    const next = new Set(completados);
    const wasCompleted = next.has(id);
    wasCompleted ? next.delete(id) : next.add(id);
    setCompletados(next);
    localStorage.setItem(`wikiratioo_completados_${userId}`, JSON.stringify([...next]));
    toast.success(wasCompleted ? 'Módulo desmarcado' : 'Módulo completado');
  };

  const modulo = MODULOS.find(m => m.id === selected);
  const progreso = Math.round((completados.size / MODULOS.length) * 100);

  const filtered = MODULOS.filter(m => {
    if (categoria && m.categoria !== categoria) return false;
    if (search && !m.titulo.toLowerCase().includes(search.toLowerCase()) && !m.descripcion.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><BookOpen size={22} className="text-[#0a6ea9]" />Wikiratioo</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Formacion de asesores</p>
        </div>
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-2">
          <Award size={16} className={progreso === 100 ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-500'} />
          <div>
            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progreso}%` }} />
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{completados.size}/{MODULOS.length} modulos</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar modulo..."
            className="border border-gray-200 dark:border-gray-600 rounded-lg pl-7 pr-3 py-1.5 text-xs w-48 bg-white" />
        </div>
        <Tag size={12} className="text-gray-400 dark:text-gray-500" />
        {['', ...CATEGORIAS].map(c => (
          <button key={c || 'todas'} onClick={() => setCategoria(c)}
            className={`text-[10px] px-3 py-1 rounded-full border transition-colors ${categoria === c ? 'bg-[#0a6ea9] text-white border-[#0a6ea9]' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-[#0a6ea9]'}`}>
            {c || 'Todas'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Lista de modulos */}
        <div className="col-span-1 space-y-2">
          {filtered.map(m => (
            <button key={m.id} onClick={() => setSelected(m.id)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selected === m.id ? 'border-[#0a6ea9] bg-blue-50' : 'border-gray-200 dark:border-gray-700 bg-white hover:border-[#b8b0b8]'
              }`}>
              <div className="flex items-center gap-2">
                {completados.has(m.id) ? (
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                ) : m.tipo === 'video' ? (
                  <Play size={14} className="text-gray-500 dark:text-gray-400 shrink-0" />
                ) : (
                  <FileText size={14} className="text-gray-500 dark:text-gray-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{m.titulo}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">{m.tipo} · {m.duracion} · {m.categoria}</p>
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8">
              <Search size={36} className="text-gray-400 dark:text-gray-500 mx-auto mb-2" />
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Sin resultados</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">Prueba con otro término de búsqueda o categoría</p>
            </div>
          )}
        </div>

        {/* Contenido del modulo */}
        <div className="col-span-2">
          {modulo ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {modulo.tipo === 'video' ? <Play size={16} className="text-[#0a6ea9]" /> : <FileText size={16} className="text-[#0a6ea9]" />}
                  <h2 className="text-sm font-semibold">{modulo.titulo}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-[#f0f0f8] rounded-full px-2 py-0.5">{modulo.categoria}</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-[#f0f0f8] rounded-full px-2 py-0.5 flex items-center gap-1"><Clock size={10} /> {modulo.duracion}</span>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{modulo.descripcion}</p>

              {/* Contenido del modulo */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
                <h4 className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Temas cubiertos</h4>
                <ul className="space-y-2">
                  {modulo.contenido.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <ChevronRight size={12} className="text-[#0a6ea9] mt-0.5 shrink-0" />
                      <span className="text-gray-900 dark:text-white">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Media */}
              {modulo.mediaUrl ? (
                <div className="bg-black rounded-lg overflow-hidden mb-4 aspect-video">
                  {modulo.mediaUrl.includes('youtu') ? (
                    <iframe
                      src={modulo.mediaUrl.replace('watch?v=', 'embed/').replace('live/', 'embed/').replace('youtu.be/', 'youtube.com/embed/').split('?')[0]}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={modulo.titulo}
                    />
                  ) : (
                    <a href={modulo.mediaUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full h-full text-xs font-medium text-[#0a6ea9] bg-white hover:bg-[#f0f4ff] transition-colors">
                      <ExternalLink size={14} /> Ver material
                    </a>
                  )}
                </div>
              ) : (
                <div className="bg-gradient-to-br from-[#f0f4ff] to-[#f8f7fa] rounded-lg p-8 text-center mb-4 border border-gray-200 dark:border-gray-600">
                  {modulo.tipo === 'video' ? (
                    <div className="space-y-2">
                      <Play size={32} className="text-gray-400 dark:text-gray-500 mx-auto" />
                      <p className="text-xs text-gray-500 dark:text-gray-400">Video de formacion</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">Disponible proximamente</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <FileText size={32} className="text-gray-400 dark:text-gray-500 mx-auto" />
                      <p className="text-xs text-gray-500 dark:text-gray-400">Guia de lectura</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">Disponible proximamente</p>
                    </div>
                  )}
                </div>
              )}

              <button onClick={() => toggleCompletado(modulo.id)}
                className={`w-full rounded-lg py-2 text-sm font-medium transition-colors ${
                  completados.has(modulo.id)
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-[#0a6ea9] text-white hover:bg-[#085d8f]'
                }`}>
                {completados.has(modulo.id) ? 'Completado' : 'Marcar como completado'}
              </button>
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <BookOpen size={48} className="text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Selecciona un modulo para empezar</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{MODULOS.length} modulos en {CATEGORIAS.length} categorias</p>
            </div>
          )}
        </div>
      </div>
      {/* ── Info ── */}
      <div className="mt-8 card-sm bg-gray-50 dark:bg-gray-800 dark:bg-[#1e1a2a] border-dashed border-gray-200 dark:border-gray-600 dark:border-[#2a1f3a]">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">💡 ¿Cómo funciona?</h3>
        <ul className="space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
          <li>· Base de conocimiento con guías, procesos y scripts. Consulta documentación y comparte mejores prácticas.</li>
        </ul>
      </div>
    </div>
  );
}
