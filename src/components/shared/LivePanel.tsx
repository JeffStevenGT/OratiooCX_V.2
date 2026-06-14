/**
 * components/shared/LivePanel.tsx — Panel en vivo: asesores y su estado
 * 
 * Datos reales de VPBX + tracking de pausas del CRM.
 * Sin simulacion. Sin datos hardcodeados.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { PhoneCall, Clock, Loader2, WifiOff } from 'lucide-react';

type Agente = {
  id: number;
  nombre: string;
  equipo: string;
  pendientes: number;
  contactados: number;
  estado: string;
  extension: string | null;
  pausaTipo?: string | null;
  pausaDesde?: string | null;
  pausaDuracion?: number;
};

const PAUSA_LABELS: Record<string, string> = {
  bano: 'Baño', almuerzo: 'Almuerzo', descanso: 'Descanso',
  reunion: 'Reunión', capacitacion: 'Capacitación', otro: 'Otro',
};

export default function LivePanel() {
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [loading, setLoading] = useState(true);
  const [vpbxConectado, setVpbxConectado] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const [uRes, vpbxRes, pausasRes] = await Promise.all([
          fetch('/api/usuarios?rol=asesor'),
          fetch('/api/vpbx/agents').catch(() => null),
          fetch('/api/pausas?equipo=1&hoy=1').catch(() => null),
        ]);
        const users = await uRes.json();
        const vpbxAgents: any[] = vpbxRes?.ok ? await vpbxRes.json() : [];
        const pausasHoy: any[] = pausasRes?.ok ? await pausasRes.json() : [];
        setVpbxConectado(vpbxAgents.length > 0);

        const pausasActivas: Record<number, any> = {};
        for (const p of pausasHoy) {
          if (!p.fin) {
            const inicio = new Date(p.inicio).getTime();
            const duracion = Math.round((Date.now() - inicio) / 1000);
            pausasActivas[p.usuario_id] = { ...p, duracionSegundos: duracion };
          }
        }

        const vpbxStatus: Record<string, string> = {};
        for (const a of vpbxAgents) {
          if (a.extension) vpbxStatus[a.extension] = a.status;
          if (a.name) vpbxStatus[a.name] = a.status;
        }

        const statusMap: Record<string, string> = {
          AVAILABLE: 'disponible', ON_BREAK: 'pausa', IN_CALL: 'activo',
          RINGING: 'activo', OFFLINE: 'offline', BUSY: 'activo',
        };

        const data = await Promise.all(users.map(async (u: any) => {
          const nRes = await fetch(`/api/pipeline/notifications?user_id=${u.id}&rol=asesor`);
          const n = await nRes.json();
          const ext = u.extension_vpbx;
          const vpbxEstado = vpbxStatus[ext] || vpbxStatus[u.nombre] || vpbxStatus[`a${ext}`];
          const pausaActiva = pausasActivas[u.id];

          return {
            id: u.id, nombre: u.nombre, equipo: u.equipo || '',
            extension: u.extension_vpbx || null,
            pendientes: n.totalPendientes || 0,
            contactados: n.totalContactados || 0,
            estado: vpbxEstado ? (statusMap[vpbxEstado] || vpbxEstado.toLowerCase()) : 'sin_conexion',
            pausaTipo: pausaActiva?.tipo || null,
            pausaDesde: pausaActiva?.inicio || null,
            pausaDuracion: pausaActiva?.duracionSegundos || 0,
          };
        }));

        setAgentes(data.sort((a, b) => b.contactados - a.contactados));
      } catch { /* */ }
      setLoading(false);
    };
    poll();
    intervalRef.current = setInterval(poll, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const disponibles = agentes.filter(a => a.estado === 'disponible').length;
  const activos = agentes.filter(a => a.estado === 'activo').length;
  const enPausa = agentes.filter(a => a.estado === 'pausa').length;

  const formatDuracion = (segundos: number) => {
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {!vpbxConectado && !loading && (
        <div className="flex items-center justify-center gap-2 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <WifiOff size={14} className="text-amber-500" />
          <span className="text-[11px] text-amber-700 font-medium">VPBX no conectado — datos reales no disponibles</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-emerald-700">{disponibles}</p>
          <p className="text-[10px] text-emerald-600">Disponibles</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{activos}</p>
          <p className="text-[10px] text-blue-600">En llamada</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{enPausa}</p>
          <p className="text-[10px] text-amber-600">En Pausa</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-[#b8b0b8]" /></div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {agentes.map(a => {
            const isActive = a.estado === 'activo';
            const isPausa = a.estado === 'pausa';
            const isDisponible = a.estado === 'disponible';
            const isOffline = a.estado === 'offline' || a.estado === 'sin_conexion';
            const pausaLabel = a.pausaTipo ? PAUSA_LABELS[a.pausaTipo] : null;

            return (
              <div key={a.id} className={`card border-l-4 ${
                isDisponible ? 'border-emerald-400 bg-emerald-50/30' :
                isActive ? 'border-blue-400 bg-blue-50/30' :
                isPausa ? 'border-amber-400 bg-amber-50/30' :
                'border-gray-300 bg-gray-50/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">{a.nombre}</span>
                  <span className={`w-2 h-2 rounded-full ${
                    isDisponible ? 'bg-emerald-400 animate-pulse' :
                    isActive ? 'bg-blue-400 animate-pulse' :
                    isPausa ? 'bg-amber-400' :
                    'bg-gray-300'
                  }`} />
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[#7c757c] mb-1">
                  <PhoneCall size={10} />
                  <span>{a.contactados} contactos</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[#7c757c] mb-1">
                  <Clock size={10} />
                  <span>{a.pendientes} pendientes</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-[9px] font-medium capitalize ${
                    isDisponible ? 'text-emerald-600' :
                    isActive ? 'text-blue-600' :
                    isPausa ? 'text-amber-600' :
                    'text-gray-400'
                  }`}>
                    {isPausa && pausaLabel ? pausaLabel : (isOffline ? 'sin conexion' : a.estado)}
                  </span>
                  {a.extension && <span className="text-[9px] text-[#b8b0b8]">Ext. {a.extension}</span>}
                </div>
                {isPausa && a.pausaDuracion !== undefined && a.pausaDuracion > 0 && (() => {
                  const s = a.pausaDuracion;
                  const color = s < 300 ? 'text-amber-600' : s < 900 ? 'text-orange-500' : s < 1800 ? 'text-orange-600' : 'text-red-500';
                  return (
                    <div className={`mt-1.5 flex items-center gap-1 text-[9px] font-mono ${color} transition-colors duration-500`}>
                      <Clock size={9} />
                      {formatDuracion(s)}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
