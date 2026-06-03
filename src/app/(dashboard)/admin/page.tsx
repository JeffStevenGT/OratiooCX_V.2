import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import pool from '@/lib/db';
import StatCard from '@/components/shared/StatCard';
import { Users, CheckCircle2, Clock, AlertTriangle, Database } from 'lucide-react';

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { rows: [stats] } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM clientes) as total_clientes,
      (SELECT COUNT(*) FROM clientes_proyectos WHERE datos->>'estado' = 'completado') as completados,
      (SELECT COUNT(*) FROM clientes_proyectos WHERE datos->>'estado' = 'pendiente') as pendientes,
      (SELECT COUNT(*) FROM clientes_proyectos WHERE datos->>'estado' = 'error') as errores,
      (SELECT COUNT(*) FROM usuarios) as total_usuarios
  `);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#1a1030]">Dashboard Administrador</h1>
      <div className="grid grid-cols-5 gap-4">
        <StatCard icon={Users} value={Number(stats?.total_clientes) || 0} label="Clientes" />
        <StatCard icon={CheckCircle2} value={Number(stats?.completados) || 0} label="Completados" variant="success" />
        <StatCard icon={Clock} value={Number(stats?.pendientes) || 0} label="Pendientes" variant="warning" />
        <StatCard icon={AlertTriangle} value={Number(stats?.errores) || 0} label="Errores" variant="danger" />
        <StatCard icon={Database} value={Number(stats?.total_usuarios) || 0} label="Usuarios" variant="purple" />
      </div>
    </div>
  );
}
