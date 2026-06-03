/**
 * app/(dashboard)/wikiratioo/page.tsx — Wikiratioo: Formación
 */

'use client';

import { useState } from 'react';
import { BookOpen, Play, FileText, CheckCircle2, ChevronRight, Award } from 'lucide-react';

const MODULOS = [
  {
    id: 1, titulo: 'Bienvenida a Oratioo', tipo: 'video', duracion: '5 min',
    descripcion: 'Conocé la plataforma, tus herramientas y cómo empezar a vender.',
  },
  {
    id: 2, titulo: 'Power Dialer: Cómo llamar', tipo: 'guia', duracion: '8 min',
    descripcion: 'Aprendé a usar el discador, gestionar leads y tipificar resultados.',
  },
  {
    id: 3, titulo: 'Entendiendo CIMA y Renove', tipo: 'guia', duracion: '10 min',
    descripcion: 'Qué significan los indicadores CIMA y Renove. Cómo usarlos para vender más.',
  },
  {
    id: 4, titulo: 'Pipeline Comercial', tipo: 'video', duracion: '7 min',
    descripcion: 'El ciclo de ventas: desde el primer contacto hasta la activación.',
  },
  {
    id: 5, titulo: 'Productos Orange', tipo: 'guia', duracion: '15 min',
    descripcion: 'Paquetes, fibra, móvil, TV. Todo lo que podés ofrecer.',
  },
  {
    id: 6, titulo: 'Objecciones Frecuentes', tipo: 'video', duracion: '12 min',
    descripcion: 'Cómo responder a "ya tengo", "es muy caro", "llámame después".',
  },
];

export default function WikiratiooPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [completados, setCompletados] = useState<Set<number>>(new Set());

  const toggleCompletado = (id: number) => {
    const next = new Set(completados);
    next.has(id) ? next.delete(id) : next.add(id);
    setCompletados(next);
  };

  const modulo = MODULOS.find(m => m.id === selected);
  const progreso = Math.round((completados.size / MODULOS.length) * 100);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a1030]">Wikiratioo</h1>
          <p className="text-sm text-[#7c757c] mt-0.5">Formación de asesores</p>
        </div>
        {/* Barra de progreso */}
        <div className="flex items-center gap-3 bg-[#f8f7fa] rounded-lg px-4 py-2">
          <Award size={16} className={progreso === 100 ? 'text-emerald-500' : 'text-[#b8b0b8]'} />
          <div>
            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progreso}%` }} />
            </div>
            <p className="text-[10px] text-[#7c757c] mt-0.5">{completados.size}/{MODULOS.length} módulos</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Lista de módulos */}
        <div className="col-span-1 space-y-2">
          {MODULOS.map(m => (
            <button key={m.id} onClick={() => setSelected(m.id)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selected === m.id ? 'border-[#0a6ea9] bg-blue-50' : 'border-[#e8dce6] bg-white hover:border-[#b8b0b8]'
              }`}>
              <div className="flex items-center gap-2">
                {completados.has(m.id) ? (
                  <CheckCircle2 size={14} className="text-emerald-500" />
                ) : m.tipo === 'video' ? (
                  <Play size={14} className="text-[#7c757c]" />
                ) : (
                  <FileText size={14} className="text-[#7c757c]" />
                )}
                <div>
                  <p className="text-xs font-medium">{m.titulo}</p>
                  <p className="text-[10px] text-[#b8b0b8]">{m.tipo} · {m.duracion}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Contenido del módulo */}
        <div className="col-span-2">
          {modulo ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {modulo.tipo === 'video' ? <Play size={16} className="text-[#0a6ea9]" /> : <FileText size={16} className="text-[#0a6ea9]" />}
                  <h2 className="text-sm font-semibold">{modulo.titulo}</h2>
                </div>
                <span className="text-[10px] text-[#7c757c] bg-[#f0f0f8] rounded-full px-2 py-0.5">{modulo.duracion}</span>
              </div>
              <p className="text-sm text-[#7c757c] mb-6">{modulo.descripcion}</p>

              {/* Contenido placeholder */}
              <div className="bg-[#f8f7fa] rounded-lg p-8 text-center mb-6">
                {modulo.tipo === 'video' ? (
                  <div className="space-y-3">
                    <Play size={40} className="text-[#b8b0b8] mx-auto" />
                    <p className="text-xs text-[#7c757c]">Video de formación</p>
                    <p className="text-[10px] text-[#b8b0b8]">El contenido se cargará cuando esté disponible</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <FileText size={40} className="text-[#b8b0b8] mx-auto" />
                    <p className="text-xs text-[#7c757c]">Guía de lectura</p>
                    <p className="text-[10px] text-[#b8b0b8]">El contenido se cargará cuando esté disponible</p>
                  </div>
                )}
              </div>

              <button onClick={() => toggleCompletado(modulo.id)}
                className={`w-full rounded-lg py-2 text-sm font-medium transition-colors ${
                  completados.has(modulo.id)
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-[#0a6ea9] text-white hover:bg-[#085d8f]'
                }`}>
                {completados.has(modulo.id) ? '✓ Completado' : 'Marcar como completado'}
              </button>
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <BookOpen size={48} className="text-[#b8b0b8] mb-4" />
              <p className="text-sm text-[#7c757c]">Seleccioná un módulo para empezar</p>
              <p className="text-xs text-[#b8b0b8] mt-1">{MODULOS.length} módulos disponibles</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
