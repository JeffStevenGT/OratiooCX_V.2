/**
 * components/shared/Sidebar.tsx — Menú Lateral con secciones colapsables
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useProject } from '@/lib/project-context';
import {
  LayoutDashboard, Users, Settings, Upload, LogOut,
  Shield, Phone, Calendar, BookOpen, Package, Globe,
  AlertTriangle, Target, UserPlus, ChevronDown, ChevronRight,
} from 'lucide-react';
import NotificationBadge from './NotificationBadge';
import OratiooLogo from './OratiooLogo';

interface SidebarProps { userName: string; userRole: string; userId?: string; }

type MenuItem = { to: string; icon: any; label: string; roles: string[]; proyectos?: string[] };

const MENU_ITEMS: { label: string; items: MenuItem[] }[] = [
  {
    label: 'Dashboard',
    items: [
      { to: '/jefe', icon: LayoutDashboard, label: 'General', roles: ['jefe_area', 'desarrollador', 'it'] },
      { to: '/asesor', icon: LayoutDashboard, label: 'Asesor', roles: ['asesor'] },
      { to: '/supervisor', icon: LayoutDashboard, label: 'Supervisor', roles: ['supervisor'] },
      { to: '/backoffice', icon: LayoutDashboard, label: 'BO', roles: ['back_office'] },
      { to: '/admin', icon: LayoutDashboard, label: 'Admin', roles: ['it', 'desarrollador'] },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { to: '/power-dialer', icon: Phone, label: 'Power Dialer', roles: ['asesor', 'supervisor'], proyectos: ['orange'] },
      { to: '/agenda', icon: Calendar, label: 'Agenda', roles: ['asesor', 'supervisor'] },
      { to: '/clientes', icon: Users, label: 'Clientes', roles: ['supervisor', 'jefe_area', 'it', 'desarrollador'] },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { to: '/backoffice/tramitacion', icon: Package, label: 'Tramitación', roles: ['back_office'] },
      { to: '/asignar-leads', icon: UserPlus, label: 'Asignar Leads', roles: ['jefe_area', 'supervisor', 'desarrollador'] },
      { to: '/proyectos', icon: Globe, label: 'Proyectos', roles: ['jefe_area', 'desarrollador'] },
      { to: '/metas', icon: Target, label: 'Metas', roles: ['supervisor', 'jefe_area'] },
      { to: '/alertas', icon: AlertTriangle, label: 'Alertas', roles: ['supervisor', 'jefe_area'] },
    ],
  },
  {
    label: 'Formación',
    items: [
      { to: '/wikiratioo', icon: BookOpen, label: 'Wikiratioo', roles: ['asesor', 'supervisor', 'jefe_area', 'back_office', 'it', 'desarrollador'] },
    ],
  },
  {
    label: 'Administración',
    items: [
      { to: '/usuarios', icon: Shield, label: 'Usuarios', roles: ['jefe_area', 'desarrollador'] },
      { to: '/infraestructura', icon: Settings, label: 'Infraestructura', roles: ['it', 'desarrollador'] },
      { to: '/bots', icon: Globe, label: 'Apps', roles: ['it', 'desarrollador'] },
      { to: '/admin/documentos', icon: Upload, label: 'Documentos', roles: ['supervisor', 'jefe_area', 'it', 'desarrollador'] },
      { to: '/config', icon: Settings, label: 'Configuración', roles: ['it', 'desarrollador'] },
    ],
  },
];

export default function Sidebar({ userName, userRole, userId }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['Dashboard']));
  const { proyecto } = useProject();

  const isActive = (to: string) => pathname === to;
  const canSee = (roles: string[]) => roles.includes(userRole);

  const toggleSection = (label: string) => {
    const next = new Set(openSections);
    next.has(label) ? next.delete(label) : next.add(label);
    setOpenSections(next);
  };

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-56'} bg-[#481163] border-r border-[#5d1a7a] flex flex-col transition-all duration-300 h-screen sticky top-0`}>
      <div className="flex flex-col items-center gap-2 px-4 py-4 border-b border-[#5d1a7a]">
        {!collapsed ? (
          <>
            <OratiooLogo className="w-28 h-6" color="white" />
            <div className="flex items-center gap-2 w-full">
              <span className="text-xs text-[#a8a0b8] truncate flex-1">{userName}</span>
              <NotificationBadge userId={userId} userRole={userRole} />
            </div>
          </>
        ) : (
          <div className="w-7 h-7 rounded-md bg-[#0a6ea9] flex items-center justify-center text-white text-xs font-bold">O</div>
        )}
      </div>

      <button onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-8 mx-2 my-2 rounded text-[#a8a0b8] hover:bg-[#5d1a7a]/50 hover:text-white transition-colors text-xs">
        {collapsed ? '→' : '←'}
      </button>

      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {MENU_ITEMS.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (!canSee(item.roles)) return false;
            if (item.proyectos && proyecto && !item.proyectos.includes(proyecto.nombre)) return false;
            return true;
          });
          if (visibleItems.length === 0) return null;

          const isOpen = openSections.has(group.label);

          return (
            <div key={group.label}>
              {!collapsed ? (
                <button onClick={() => toggleSection(group.label)}
                  className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[10px] font-semibold text-[#a8a0b8] uppercase tracking-wider hover:text-white transition-colors">
                  {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  {group.label}
                </button>
              ) : null}
              {isOpen && (
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.to);
                    return (
                      <Link key={item.to} href={item.to}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                          active ? 'bg-[#0a6ea9] text-white shadow-sm' : 'text-[#c4bcc4] hover:bg-[#5d1a7a]/50 hover:text-white'
                        } ${collapsed ? 'justify-center' : ''}`}
                        title={collapsed ? item.label : undefined}>
                        <Icon size={18} />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-[#5d1a7a] p-3">
        {!collapsed && (
          <a href="/perfil" className="text-xs text-[#a8a0b8] hover:text-white truncate mb-2 block">{userName}</a>
        )}
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 text-xs text-[#c4bcc4] hover:text-white transition-colors w-full px-1">
          <LogOut size={14} /> {!collapsed && 'Salir'}
        </button>
      </div>
    </aside>
  );
}
