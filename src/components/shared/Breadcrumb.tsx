/**
 * components/shared/Breadcrumb.tsx — Navegación contextual
 * =========================================================
 * Breadcrumbs automáticos basados en el pathname.
 *
 * Uso (en layout):
 *   <Breadcrumb />
 *
 * Mapea rutas a nombres legibles:
 *   /clientes → Inicio / Clientes
 *   /pipeline/estadisticas → Inicio / Pipeline / Estadísticas
 */

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

const LABELS: Record<string, string> = {
  inicio: 'Inicio',
  clientes: 'Clientes',
  pipeline: 'Pipeline',
  agenda: 'Agenda',
  asignar: 'Asignar Leads',
  bots: 'Bots',
  admin: 'Admin',
  jefe: 'Jefe de Área',
  supervisor: 'Supervisor',
  asesor: 'Asesor',
  backoffice: 'Backoffice',
  estadisticas: 'Estadísticas',
  auditoria: 'Auditoría',
  calidad: 'Calidad',
  usuarios: 'Usuarios',
  infraestructura: 'Infraestructura',
  proyectos: 'Proyectos',
  metas: 'Metas',
  alertas: 'Alertas',
  config: 'Configuración',
  rendimiento: 'Rendimiento',
  inteligencia: 'Inteligencia',
  perfil: 'Perfil',
  wikiratioo: 'WikiRatioo',
  vpbx: 'VPBX',
  'power-dialer': 'Power Dialer',
  tramitacion: 'Tramitación',
};

export default function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  // Rutas principales del dashboard
  if (segments[0] !== 'inicio' && segments.length === 1) return null;

  const crumbs = segments.map((seg, i) => ({
    label: LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
    href: '/' + segments.slice(0, i + 1).join('/'),
    last: i === segments.length - 1,
  }));

  if (crumbs.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1 text-xs text-[#b8b0b8] mb-1 animate-fade-in">
      <Link href="/inicio" className="hover:text-[#0a6ea9] transition-colors">
        <Home size={12} />
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight size={10} />
          {crumb.last ? (
            <span className="text-[#7c757c] font-medium">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-[#0a6ea9] transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
