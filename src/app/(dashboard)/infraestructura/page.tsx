/**
 * app/(dashboard)/infraestructura/page.tsx — Máquinas y Proxies
 */

'use client';

import { useState, useEffect } from 'react';
import { Monitor, Wifi, Globe, Server } from 'lucide-react';

export default function InfraestructuraPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#1a1030]">Infraestructura</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <Monitor size={32} className="text-[#0a6ea9] mx-auto mb-2" />
          <p className="text-2xl font-bold text-[#1a1030]">1</p>
          <p className="text-xs text-[#7c757c]">Máquina activa</p>
        </div>
        <div className="card text-center">
          <Wifi size={32} className="text-[#481163] mx-auto mb-2" />
          <p className="text-2xl font-bold text-[#1a1030]">20</p>
          <p className="text-xs text-[#7c757c]">Proxies disponibles</p>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-[#1a1030] mb-3">Proxies</h3>
        <p className="text-xs text-[#7c757c]">
          Los proxies se configuran en <code className="bg-[#f0f0f8] px-1 rounded">bot/proxies.txt</code>.
          El coordinator los asigna automáticamente 1:1 por worker.
        </p>
      </div>
    </div>
  );
}
