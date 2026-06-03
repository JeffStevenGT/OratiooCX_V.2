/**
 * app/(dashboard)/bots/page.tsx — Control de Bots
 */

export default function BotsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#1a1030]">Bots</h1>
      <div className="grid grid-cols-3 gap-4">
        {[
          { name: 'Orange', status: 'inactivo', color: 'bg-red-400' },
          { name: 'Mainjobs', status: 'pendiente', color: 'bg-amber-400' },
          { name: 'Impresoras', status: 'pendiente', color: 'bg-gray-400' },
        ].map((bot) => (
          <div key={bot.name} className="card text-center">
            <div className={`w-3 h-3 rounded-full ${bot.color} mx-auto mb-2`} />
            <p className="text-sm font-medium">{bot.name}</p>
            <p className="text-xs text-[#7c757c]">{bot.status}</p>
          </div>
        ))}
      </div>
      <div className="card">
        <h3 className="text-sm font-semibold mb-2">Worker Orange</h3>
        <p className="text-xs text-[#7c757c]">
          Ejecuta <code className="bg-[#f0f0f8] px-1 rounded">python bot/worker_structured.py</code> o el coordinator.
          Los resultados se envían al backend vía HTTP (API-First).
        </p>
      </div>
    </div>
  );
}
