/**
 * components/shared/Sidebar.tsx — Menú Lateral por Rol
 * ======================================================
 * Filtra enlaces según el rol del usuario.
 * Mismo diseño dark purple que el Oratioo CX original.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import NotificationBadge from './NotificationBadge';
import {
  LayoutDashboard, Users, Settings, Upload, LogOut,
  Shield, Phone, Calendar, BookOpen, Package, Globe,
  AlertTriangle, Target, UserPlus,
} from 'lucide-react';

interface SidebarProps {
  userName: string;
  userRole: string;
  userId?: string;
}

// Menú completo por grupos
const MENU_ITEMS: {
  label: string;
  items: { to: string; icon: any; label: string; roles: string[] }[];
}[] = [
  {
    label: 'Principal',
    items: [
      { to: '/asesor', icon: LayoutDashboard, label: 'Dashboard Asesor', roles: ['asesor'] },
      { to: '/supervisor', icon: LayoutDashboard, label: 'Dashboard Supervisor', roles: ['supervisor'] },
      { to: '/jefe', icon: LayoutDashboard, label: 'Dashboard Jefe', roles: ['jefe_area'] },
      { to: '/backoffice', icon: LayoutDashboard, label: 'Dashboard BO', roles: ['back_office'] },
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard Admin', roles: ['it', 'desarrollador'] },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { to: '/power-dialer', icon: Phone, label: 'Power Dialer', roles: ['asesor', 'supervisor'] },
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
      { to: '/bots', icon: Globe, label: 'Bots', roles: ['it', 'desarrollador'] },
      { to: '/admin/documentos', icon: Upload, label: 'Documentos', roles: ['supervisor', 'jefe_area', 'it', 'desarrollador'] },
    ],
  },
];

export default function Sidebar({ userName, userRole, userId }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (to: string) => pathname === to;
  const canSee = (roles: string[]) => roles.includes(userRole);

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-56'} bg-[#481163] border-r border-[#5d1a7a] flex flex-col transition-all duration-300 h-screen sticky top-0`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 h-14 px-4 border-b border-[#5d1a7a]">
        {!collapsed && (
          <>
            <div className="w-7 h-7 rounded-md bg-[#0a6ea9] flex items-center justify-center text-white text-xs font-bold">
              O
            </div>
            <span className="text-sm font-bold text-white">Oratioo CX</span>
            <NotificationBadge userId={userId} userRole={userRole} />
          </>
        )}
      </div>

      {/* Toggle collapse */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-8 mx-2 my-2 rounded text-[#a8a0b8] hover:bg-[#5d1a7a]/50 hover:text-white transition-colors text-xs"
      >
        {collapsed ? '→' : '←'}
      </button>

      {/* Menú */}
      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
        {MENU_ITEMS.map((group) => {
          const visibleItems = group.items.filter((item) => canSee(item.roles));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              {!collapsed && (
                <p className="text-[10px] font-semibold text-[#a8a0b8] uppercase tracking-wider px-3 mb-1">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.to);
                  return (
                    <Link
                      key={item.to}
                      href={item.to}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                        active
                          ? 'bg-[#0a6ea9] text-white shadow-sm'
                          : 'text-[#c4bcc4] hover:bg-[#5d1a7a]/50 hover:text-white'
                      } ${collapsed ? 'justify-center' : ''}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon size={18} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer — Usuario + Logout */}
      <div className="border-t border-[#5d1a7a] p-3">
        {!collapsed && (
          <p className="text-xs text-[#a8a0b8] truncate mb-2">{userName}</p>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 text-xs text-[#c4bcc4] hover:text-white transition-colors w-full px-1"
          title="Cerrar sesión"
        >
          <LogOut size={14} />
          {!collapsed && 'Salir'}
        </button>
      </div>
    </aside>
  );
}
