/**
 * app/(dashboard)/config/page.tsx — Configuración Global
 */

'use client';

import { Settings, Save } from 'lucide-react';

export default function ConfigPage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-xl">
      <h1 className="text-xl font-bold text-[#1a1030]">Configuración</h1>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Settings size={16} className="text-[#0a6ea9]" /> Parámetros del Bot</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#f8f7fa] rounded-lg p-3">
            <p className="text-[10px] text-[#7c757c]">Timeout rescate DNIs</p>
            <p className="text-sm font-bold">30 minutos</p>
            <p className="text-[9px] text-[#b8b0b8]">Editable próximamente</p>
          </div>
          <div className="bg-[#f8f7fa] rounded-lg p-3">
            <p className="text-[10px] text-[#7c757c]">Liberación leads</p>
            <p className="text-sm font-bold">3 días</p>
            <p className="text-[9px] text-[#b8b0b8]">Editable próximamente</p>
          </div>
          <div className="bg-[#f8f7fa] rounded-lg p-3">
            <p className="text-[10px] text-[#7c757c]">Debounce llamadas</p>
            <p className="text-sm font-bold">5 segundos</p>
          </div>
          <div className="bg-[#f8f7fa] rounded-lg p-3">
            <p className="text-[10px] text-[#7c757c]">Watchdog extracción</p>
            <p className="text-sm font-bold">40 segundos</p>
          </div>
        </div>

        <p className="text-[10px] text-[#b8b0b8] text-center pt-2">
          Estos valores están definidos en el código. Serán editables desde aquí en una versión futura.
        </p>
      </div>
    </div>
  );
}
