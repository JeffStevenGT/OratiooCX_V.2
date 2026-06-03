'use client';

import { useState } from 'react';
import { Play, Pause, RotateCcw, Square, Loader2, Globe, Users } from 'lucide-react';

export default function BotsPage() {
  const [sending, setSending] = useState<string | null>(null);
  const [workers, setWorkers] = useState(5);

  const sendCommand = async (cmd: string) => {
    setSending(cmd);
    await fetch('/api/bot/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comando: cmd, workers }),
    });
    setTimeout(() => setSending(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#1a1030]">Bots</h1>

      <div className="card">
        <h3 className="text-sm font-semibold mb-4">Control — Bot Orange</h3>

        {/* Workers selector */}
        <div className="flex items-center gap-3 mb-4">
          <Users size={16} className="text-[#7c757c]" />
          <label className="text-sm text-[#7c757c]">Workers:</label>
          <input
            type="number"
            min={1} max={20}
            value={workers}
            onChange={(e) => setWorkers(Math.max(1, Math.min(20, +e.target.value)))}
            className="border border-[#e0e0f0] rounded-lg px-3 py-1.5 text-sm w-20 text-center"
          />
        </div>

        <div className="grid grid-cols-4 gap-3">
          <ControlButton icon={Play} label="Iniciar" color="bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            loading={sending === 'iniciar'} onClick={() => sendCommand('iniciar')} />
          <ControlButton icon={Pause} label="Pausar" color="bg-amber-100 text-amber-700 hover:bg-amber-200"
            loading={sending === 'pausar'} onClick={() => sendCommand('pausar')} />
          <ControlButton icon={RotateCcw} label="Reanudar" color="bg-blue-100 text-blue-700 hover:bg-blue-200"
            loading={sending === 'reanudar'} onClick={() => sendCommand('reanudar')} />
          <ControlButton icon={Square} label="Detener" color="bg-red-100 text-red-700 hover:bg-red-200"
            loading={sending === 'detener'} onClick={() => sendCommand('detener')} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[{name:'Orange',status:'listo',color:'bg-emerald-400'},{name:'Mainjobs',status:'pendiente',color:'bg-amber-400'},{name:'Impresoras',status:'pendiente',color:'bg-gray-400'}].map(bot=>(
          <div key={bot.name} className="card text-center">
            <Globe size={24} className="text-[#481163] mx-auto mb-2" />
            <p className="text-sm font-medium">{bot.name}</p>
            <span className={`inline-flex items-center gap-1 text-xs text-[#7c757c] mt-1`}>
              <span className={`w-2 h-2 rounded-full ${bot.color}`} />{bot.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ControlButton({ icon: Icon, label, color, loading, onClick }: any) {
  return (
    <button onClick={onClick} disabled={!!loading}
      className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition-all ${color} disabled:opacity-50`}>
      {loading ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
      <span className="text-sm">{label}</span>
    </button>
  );
}
