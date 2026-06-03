/**
 * app/(dashboard)/alertas/page.tsx — Alertas
 */

'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, UserMinus, UserPlus, Gift, Loader2 } from 'lucide-react';

type Alerta = { id: number; id_cliente: string; tipo: string; linea_numero: string | null; valor_anterior: string | null; valor_nuevo: string | null; created_at: string };

export default function AlertasPage() {
  const [detecciones, setDetecciones] = useState<Alerta[]>([]);
  const [porVencer, setPorVencer] = useState(0);
  const [liberados, setLiberados] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Últimas detecciones (últimos 2 días)
        const dRes = await fetch('/api/detecciones');
        setDetecciones(await dRes.json());

        // Pipeline alerts
        const pRes = await fetch('/api/pipeline/notifications?user_id=0&rol=supervisor');
        const pData = await pRes.json();
        setLiberados(pData.liberados || 0);
        setPorVencer(pData.porVencer || 0);
      } catch { /* */ }
      setLoading(false);
    };
    fetchData();
  }, []);

  const tipoLabel: Record<string, { icon: any; label: string; color: string }> = {
    cliente_perdido: { icon: UserMinus, label: 'Cliente se fue', color: 'text-red-500' },
    cliente_recuperado: { icon: UserPlus, label: 'Cliente volvió', color: 'text-emerald-500' },
    renove_nuevo: { icon: Gift, label: 'Nuevo Renove', color: 'text-blue-500' },
    permanencia_vencida: { icon: Clock, label: 'Permanencia venció', color: 'text-amber-500' },
    linea_eliminada: { icon: AlertTriangle, label: 'Línea dada de baja', color: 'text-red-500' },
    linea_nueva: { icon: AlertTriangle, label: 'Línea nueva', color: 'text-emerald-500' },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#1a1030]">Alertas</h1>

      {/* Pipeline alerts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <Clock size={28} className="text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-[#1a1030]">{porVencer}</p>
          <p className="text-xs text-[#7c757c]">Leads por vencer</p>
        </div>
        <div className="card text-center">
          <UserMinus size={28} className="text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-[#1a1030]">{liberados}</p>
          <p className="text-xs text-[#7c757c]">Leads liberados hoy</p>
        </div>
      </div>

      {/* Detecciones del bot */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-4">Cambios detectados (últimas 48h)</h3>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#b8b0b8]" /></div>
        ) : detecciones.length === 0 ? (
          <p className="text-xs text-[#7c757c] text-center py-8">Sin cambios detectados recientemente</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {detecciones.slice(0, 50).map(d => {
              const info = tipoLabel[d.tipo] || { icon: AlertTriangle, label: d.tipo, color: 'text-gray-500' };
              const Icon = info.icon;
              return (
                <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#f8f7fa] text-xs">
                  <Icon size={14} className={info.color} />
                  <span className="font-mono text-[#0a6ea9]">{d.id_cliente}</span>
                  <span className="text-[#7c757c]">{info.label}</span>
                  {d.linea_numero && <span className="font-mono text-[10px] text-[#b8b0b8]">{d.linea_numero.slice(-4)}</span>}
                  {d.valor_nuevo && <span className="text-[#7c757c] truncate max-w-[200px]">{d.valor_nuevo}</span>}
                  <span className="ml-auto text-[10px] text-[#b8b0b8]">
                    {d.created_at ? new Date(d.created_at).toLocaleString('es-PE') : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
