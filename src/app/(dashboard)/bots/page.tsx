/**
 * app/(dashboard)/bots/page.tsx — Control de Bots con Botones
 */

'use client';

import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Square, Loader2, Globe } from 'lucide-react';

export default function BotsPage() {
  const [sending, setSending] = useState<string | null>(null);

  const sendCommand = async (cmd: string) => {
    setSending(cmd);
    await fetch('/api/bot/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comando: cmd }),
    });
    setTimeout(() => setSending(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#1a1030]">Bots</h1>

      {/* Control Panel */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-4">Control — Bot Orange</h3>
        <div className="grid grid-cols-4 gap-3">
          <ControlButton
            icon={Play}
            label="Iniciar"
            color="bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            loading={sending === 'iniciar'}
            onClick={() => sendCommand('iniciar')}
          />
          <ControlButton
            icon={Pause}
            label="Pausar"
            color="bg-amber-100 text-amber-700 hover:bg-amber-200"
            loading={sending === 'pausar'}
            onClick={() => sendCommand('pausar')}
          />
          <ControlButton
            icon={RotateCcw}
            label="Reanudar"
            color="bg-blue-100 text-blue-700 hover:bg-blue-200"
            loading={sending === 'reanudar'}
            onClick={() => sendCommand('reanudar')}
          />
          <ControlButton
            icon={Square}
            label="Detener"
            color="bg-red-100 text-red-700 hover:bg-red-200"
            loading={sending === 'detener'}
            onClick={() => sendCommand('detener')}
          />
        </div>
        <p className="text-xs text-[#7c757c] mt-3">
          Los comandos se envían a la tabla <code className="bg-[#f0f0f8] px-1 rounded">comandos_bot</code>.
          El bot los consulta cada 5 segundos vía <code className="bg-[#f0f0f8] px-1 rounded">GET /api/bot/command</code>.
        </p>
      </div>

      {/* Bots disponibles */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { name: 'Orange', status: 'listo', color: 'bg-emerald-400' },
          { name: 'Mainjobs', status: 'pendiente', color: 'bg-amber-400' },
          { name: 'Impresoras', status: 'pendiente', color: 'bg-gray-400' },
        ].map((bot) => (
          <div key={bot.name} className="card text-center">
            <Globe size={24} className="text-[#481163] mx-auto mb-2" />
            <p className="text-sm font-medium">{bot.name}</p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${bot.color}`} />
              <span className="text-xs text-[#7c757c]">{bot.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ControlButton({ icon: Icon, label, color, loading, onClick }: any) {
  return (
    <button
      onClick={onClick}
      disabled={!!loading}
      className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition-all ${color} disabled:opacity-50`}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
      <span className="text-sm">{label}</span>
    </button>
  );
}
