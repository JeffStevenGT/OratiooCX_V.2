'use client';

import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Square, Loader2, Globe, Users, Activity, Monitor, AlertCircle, Server } from 'lucide-react';

type Maquina = { id: number; nombre: string; ip: string | null; workers_max: number; workers_activos: number; estado: string; ultimo_heartbeat: string | null };

export default function BotsPage() {
  const [sending, setSending] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [workers, setWorkers] = useState(5);
  const [maquina, setMaquina] = useState('*');
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [statusMsg, setStatusMsg] = useState('Esperando comando');

  useEffect(() => {
    fetch('/api/maquinas')
      .then(r => r.json())
      .then(setMaquinas)
      .catch(() => {});
  }, []);

  const sendCommand = async (cmd: string, label: string) => {
    setSending(cmd);
    setStatusMsg(`Enviando "${label}" a ${maquina === '*' ? 'todas' : maquina}...`);
    try {
      const res = await fetch('/api/bot/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comando: cmd, workers, maquina }),
      });
      if (res.ok) {
        setLastAction(cmd);
        if (cmd === 'iniciar') {
          setStatusMsg(`${workers} workers en ${maquina === '*' ? 'todas las máquinas' : maquina}`);
        } else if (cmd === 'detener') {
          setStatusMsg(`Workers detenidos en ${maquina === '*' ? 'todas las máquinas' : maquina}`);
        } else if (cmd === 'pausar') {
          setStatusMsg('Workers en pausa');
        } else if (cmd === 'reanudar') {
          setStatusMsg('Workers reanudados');
        }
      }
    } catch {
      setStatusMsg('Error de conexión');
    }
    setTimeout(() => setSending(null), 1500);
  };

  const isRunning = lastAction === 'iniciar';

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#1a1030]">Bots</h1>

      {/* Status banner */}
      <div className={`card border-l-4 ${
        isRunning ? 'border-l-emerald-500' : lastAction === 'detener' ? 'border-l-red-500' : 'border-l-amber-500'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full animate-pulse ${
            isRunning ? 'bg-emerald-500' : lastAction === 'detener' ? 'bg-red-500' : 'bg-amber-500'
          }`} />
          <div>
            <p className="text-sm font-medium text-[#1a1030]">{statusMsg}</p>
            <p className="text-xs text-[#7c757c]">
              {isRunning ? `${workers} workers · ${maquina === '*' ? 'todas las máquinas' : maquina}` : 'Coordinator en espera'}
            </p>
          </div>
        </div>
      </div>

      {/* Máquinas conectadas */}
      {maquinas.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Server size={16} className="text-[#0a6ea9]" />
            Máquinas
          </h3>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {maquinas.map(m => (
              <button
                key={m.id}
                onClick={() => setMaquina(m.nombre)}
                className={`text-left p-3 rounded-xl border transition-all ${
                  maquina === m.nombre
                    ? 'border-[#0a6ea9] bg-blue-50'
                    : 'border-[#e8dce6] bg-white hover:border-[#b8b0b8]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${
                    m.estado === 'online' ? 'bg-emerald-400' : 'bg-gray-300'
                  }`} />
                  <span className="text-xs font-medium truncate">{m.nombre}</span>
                </div>
                <div className="text-[10px] text-[#7c757c]">
                  {m.workers_activos}/{m.workers_max} workers
                </div>
              </button>
            ))}
            <button
              onClick={() => setMaquina('*')}
              className={`text-left p-3 rounded-xl border transition-all ${
                maquina === '*'
                  ? 'border-[#481163] bg-purple-50'
                  : 'border-[#e8dce6] bg-white hover:border-[#b8b0b8]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Globe size={12} className="text-[#481163]" />
                <span className="text-xs font-medium">Todas</span>
              </div>
              <div className="text-[10px] text-[#7c757c]">Broadcast</div>
            </button>
          </div>
        </div>
      )}

      {/* Control card */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Activity size={16} className="text-[#0a6ea9]" />
          Control — Bot Orange
          {maquina !== '*' && (
            <span className="text-[10px] font-normal text-[#7c757c] ml-2">
              → {maquina}
            </span>
          )}
        </h3>

        {/* Workers selector */}
        <div className="flex items-center gap-3 mb-4 p-3 bg-[#f8f7fa] rounded-lg">
          <Users size={16} className="text-[#7c757c]" />
          <label className="text-sm text-[#7c757c] font-medium">Workers:</label>
          <input
            type="number"
            min={1} max={20}
            value={workers}
            onChange={(e) => setWorkers(Math.max(1, Math.min(20, +e.target.value)))}
            className="border border-[#e0e0f0] rounded-lg px-3 py-1.5 text-sm w-16 text-center font-medium bg-white"
          />
          <span className="text-xs text-[#7c757c]">
            {maquina === '*' ? 'por máquina' : `máx ${maquinas.find(m => m.nombre === maquina)?.workers_max || '?'}`}
          </span>
        </div>

        {/* Info alert */}
        <div className="flex items-start gap-2 mb-4 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
          <AlertCircle size={14} className="text-blue-500 mt-0.5" />
          <p className="text-xs text-blue-700">
            <strong>Coordinator daemon</strong> debe estar corriendo con <code className="bg-blue-100 px-1 rounded text-[10px]">--machine-name NOMBRE</code>
          </p>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <ControlButton icon={Play} label="Iniciar"
            color="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200"
            loading={sending === 'iniciar'}
            onClick={() => sendCommand('iniciar', 'Iniciar')}
            hint={`${workers} workers`} />
          <ControlButton icon={Pause} label="Pausar"
            color="bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200"
            loading={sending === 'pausar'}
            onClick={() => sendCommand('pausar', 'Pausar')} />
          <ControlButton icon={RotateCcw} label="Reanudar"
            color="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200"
            loading={sending === 'reanudar'}
            onClick={() => sendCommand('reanudar', 'Reanudar')} />
          <ControlButton icon={Square} label="Detener"
            color="bg-red-100 text-red-700 hover:bg-red-200 border-red-200"
            loading={sending === 'detener'}
            onClick={() => sendCommand('detener', 'Detener')} />
        </div>
      </div>

      {/* Bots disponibles */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Globe size={16} className="text-[#0a6ea9]" />
          Bots Disponibles
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { name: 'Orange', status: 'listo', color: 'bg-emerald-400' },
            { name: 'Mainjobs', status: 'pendiente', color: 'bg-amber-400' },
            { name: 'Impresoras', status: 'pendiente', color: 'bg-gray-400' },
          ].map((bot) => (
            <div key={bot.name} className="text-center p-4 bg-[#f8f7fa] rounded-xl border border-[#e8dce6]">
              <Globe size={24} className="text-[#481163] mx-auto mb-2" />
              <p className="text-sm font-medium">{bot.name}</p>
              <span className="inline-flex items-center gap-1 text-xs text-[#7c757c] mt-1">
                <span className={`w-2 h-2 rounded-full ${bot.color}`} />
                {bot.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ControlButton({ icon: Icon, label, color, loading, onClick, hint }: any) {
  return (
    <button onClick={onClick} disabled={!!loading}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-4 font-medium transition-all border ${color} disabled:opacity-40 disabled:cursor-not-allowed`}>
      {loading ? <Loader2 size={20} className="animate-spin" /> : <Icon size={20} />}
      <span className="text-xs font-semibold">{label}</span>
      {hint && <span className="text-[9px] opacity-60">{hint}</span>}
    </button>
  );
}
