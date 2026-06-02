import StatCard from '@/components/shared/StatCard';
import { Users, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

export default function AdminDashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#1a1030]">Dashboard Administrador</h1>
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Users} value={0} label="Total Clientes" />
        <StatCard icon={CheckCircle2} value={0} label="Completados" variant="success" />
        <StatCard icon={Clock} value={0} label="Pendientes" variant="warning" />
        <StatCard icon={AlertTriangle} value={0} label="Errores" variant="danger" />
      </div>
      <p className="text-sm text-[#7c757c]">Los datos se cargarán cuando el bot empiece a procesar.</p>
    </div>
  );
}
