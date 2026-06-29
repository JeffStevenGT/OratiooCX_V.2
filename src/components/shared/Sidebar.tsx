/**
 * components/shared/Sidebar.tsx — Menu Lateral mejorado v2
 * - Badges con contadores en ítems
 * - Secciones grandes, ítems e iconos más chicos (jerarquía visual)
 * - Acordeón: solo una sección abierta a la vez
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useProject } from '@/lib/project-context';
import { useTheme } from '@/components/shared/ThemeProvider';
import {
  LayoutDashboard, Users, Settings, Upload, LogOut,
  Shield, Phone, Calendar, BookOpen, Package, Globe,
  AlertTriangle, Target, UserPlus, ChevronDown, ChevronRight, BarChart3, Star, TrendingUp,
  PanelLeftClose, PanelLeftOpen, Moon, User, BrainCircuit, Clock, PhoneOutgoing,
} from 'lucide-react';
import NotificationBadge from './NotificationBadge';
import OratiooLogo from './OratiooLogo';

interface SidebarProps { userName: string; userRole: string; userId?: string; }

type MenuItem = { to: string; icon: any; label: string; roles: string[]; proyectos?: string[]; countKey?: string };

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
      { to: '/power-dialer', icon: Phone, label: 'Power Dialer', roles: ['asesor', 'supervisor'], proyectos: ['orange'], countKey: 'mine' },
      { to: '/agenda', icon: Calendar, label: 'Agenda', roles: ['asesor', 'supervisor'], countKey: 'agenda' },
      // { to: '/fichaje', icon: Clock, label: 'Fichaje', roles: ['asesor', 'supervisor', 'jefe_area', 'back_office', 'it', 'desarrollador'], countKey: 'fichaje' },
      { to: '/clientes', icon: Users, label: 'Clientes', roles: ['supervisor', 'jefe_area', 'it', 'desarrollador'] },
      { to: '/asignar-leads', icon: UserPlus, label: 'Asignar Leads', roles: ['jefe_area', 'supervisor', 'desarrollador'], countKey: 'pool' },
    ],
  },
  {
    label: 'Supervisión',
    items: [
      { to: '/rendimiento', icon: TrendingUp, label: 'Rendimiento', roles: ['supervisor', 'jefe_area', 'desarrollador'] },
      { to: '/inteligencia', icon: BrainCircuit, label: 'Inteligencia', roles: ['supervisor', 'jefe_area', 'desarrollador'] },
      { to: '/estadisticas', icon: BarChart3, label: 'Estadísticas', roles: ['supervisor', 'jefe_area', 'desarrollador'] },
      { to: '/auditoria', icon: Shield, label: 'Auditoría', roles: ['supervisor', 'jefe_area', 'desarrollador'] },
      { to: '/calidad', icon: Star, label: 'QA', roles: ['auditor_calidad', 'supervisor', 'jefe_area', 'desarrollador'] },
      { to: '/metas', icon: Target, label: 'Metas', roles: ['supervisor', 'jefe_area'] },
      { to: '/alertas', icon: AlertTriangle, label: 'Alertas', roles: ['supervisor', 'jefe_area'], countKey: 'alertas' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { to: '/vpbx', icon: Phone, label: 'VPBX', roles: ['supervisor', 'jefe_area', 'desarrollador', 'it'], countKey: 'vpbx' },
      { to: '/ddis', icon: PhoneOutgoing, label: 'DDIs', roles: ['it', 'desarrollador'] },
      { to: '/usuarios', icon: Shield, label: 'Usuarios', roles: ['jefe_area', 'desarrollador'] },
      { to: '/bots', icon: Globe, label: 'Apps', roles: ['it', 'desarrollador'] },
      { to: '/admin/documentos', icon: Upload, label: 'Documentos', roles: ['supervisor', 'jefe_area', 'it', 'desarrollador'] },
    ],
  },
  {
    label: 'Aprendizaje',
    items: [
      { to: '/wikiratioo', icon: BookOpen, label: 'Wikiratioo', roles: ['asesor', 'supervisor', 'jefe_area', 'back_office', 'it', 'desarrollador', 'auditor_calidad'] },
    ],
  },
];

export default function Sidebar({ userName, userRole, userId }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['Dashboard']));
  const { proyecto } = useProject();
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);

  const isActive = (to: string) => optimisticPath === to || pathname === to || pathname.startsWith(to + '/');
  const canSee = (roles: string[]) => roles.includes(userRole);

  // Acordeón real: solo una sección abierta
  const toggleSection = (label: string) => {
    setOpenSections(prev => {
      if (prev.has(label)) return new Set(); // cerrar si ya está abierta
      return new Set([label]); // abrir solo esta
    });
  };

  // Auto-abrir la sección de la ruta activa al navegar
  useEffect(() => {
    setOptimisticPath(null); // limpiar ruta optimista cuando carga la real
    for (const group of MENU_ITEMS) {
      const visible = group.items.filter(item => canSee(item.roles) && (!item.proyectos || !proyecto || item.proyectos.includes(proyecto.nombre)));
      if (visible.some(item => isActive(item.to))) {
        setOpenSections(prev => prev.has(group.label) ? prev : new Set([group.label]));
        break;
      }
    }
  }, [pathname]);

  // Fetch counts
  const fetchCounts = useCallback(async () => {
    try {
      const newCounts: Record<string, number> = {};
      const fetches: Promise<void>[] = [];

      if (['asesor', 'supervisor'].includes(userRole)) {
        fetches.push(
          fetch('/api/pipeline/mine').then(r => r.json()).then(d => {
            newCounts.mine = Array.isArray(d) ? d.length : 0;
          }).catch(() => {})
        );
      }
      if (['supervisor', 'jefe_area', 'desarrollador'].includes(userRole)) {
        const poolParams = new URLSearchParams();
        // Para supervisor, usar su propio user_id (el pipeline/notifications ya lo maneja)
        // Para jefe/dev, user_id=0 devuelve el pool global
        const poolUserId = userRole === 'supervisor' ? (userId || '0') : '0';
        fetches.push(
          fetch(`/api/pipeline/notifications?user_id=${poolUserId}&rol=supervisor`).then(r => r.json()).then(d => {
            newCounts.pool = d.sinAsignar || 0;
            newCounts.alertas = (d.liberados || 0) + (d.porVencer || 0);
          }).catch(() => {})
        );
      }
      if (['asesor', 'supervisor'].includes(userRole)) {
        fetches.push(
          fetch('/api/pipeline/agenda?count_only=1').then(r => r.json()).then(d => {
            newCounts.agenda = d.total || 0;
          }).catch(() => {})
        );
      }
      if (['supervisor', 'jefe_area', 'desarrollador', 'it'].includes(userRole)) {
        fetches.push(
          fetch('/api/vpbx/agents').then(r => r.json()).then(d => {
            newCounts.vpbx = Array.isArray(d) ? d.filter((a: any) => {
              const s = (a.status || '').toLowerCase();
              return s.includes('available') || s.includes('idle') || s.includes('ready');
            }).length : 0;
          }).catch(() => {})
        );
      }

      await Promise.all(fetches);
      setCounts(newCounts);
    } catch { /* */ }
  }, [userRole]);

  useEffect(() => { fetchCounts(); const i = setInterval(fetchCounts, 60000); return () => clearInterval(i); }, [fetchCounts]);

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-56'} bg-[#481163] dark:bg-[#1a1030] border-r border-white/5 flex flex-col transition-all duration-300 h-screen sticky top-0`}>
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b border-white/5 ${collapsed ? 'justify-center' : ''}`}>
        {!collapsed ? (
          <>
            <OratiooLogo className="w-24 h-5" color="white" />
            <button onClick={() => setCollapsed(true)}
              className="ml-auto p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
              <PanelLeftClose size={14} />
            </button>
          </>
        ) : (
          <button onClick={() => setCollapsed(false)}
            className="w-8 h-8 rounded-lg bg-[#0a6ea9] flex items-center justify-center text-white hover:bg-[#085d8f] transition-colors">
            <PanelLeftOpen size={14} />
          </button>
        )}
      </div>

      {/* User + Notifications */}
      {!collapsed && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
            <User size={12} className="text-white/60" />
          </div>
          <span className="text-[11px] text-white/60 truncate flex-1">{userName}</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {MENU_ITEMS.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (!canSee(item.roles)) return false;
            if (item.proyectos && proyecto && !item.proyectos.includes(proyecto.nombre)) return false;
            return true;
          });
          if (visibleItems.length === 0) return null;

          const hasActiveChild = visibleItems.some(item => isActive(item.to));
          const isOpen = openSections.has(group.label);

          return (
            <div key={group.label}>
              {!collapsed ? (
                <button onClick={() => toggleSection(group.label)}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-xs font-bold uppercase tracking-widest transition-all duration-150 rounded ${
                    hasActiveChild ? 'text-white/90' : 'text-white/35 hover:text-white/60'
                  }`}>
                  <span className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                    <ChevronRight size={11} />
                  </span>
                  {group.label}
                </button>
              ) : (
                <div className="flex justify-center py-1">
                  <div className="w-6 h-px bg-white/10" />
                </div>
              )}
              <div className={`overflow-hidden transition-all duration-200 ${
                isOpen || collapsed ? 'max-h-96 opacity-100 mt-0.5' : 'max-h-0 opacity-0'
              }`}>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.to);
                    const badge = item.countKey ? counts[item.countKey] : undefined;
                    return (
                      <Link key={item.to} href={item.to}
                        onClick={() => setOptimisticPath(item.to)}
                        className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-[12px] transition-all duration-150 ${
                          active
                            ? 'bg-[#0a6ea9] text-white font-medium shadow-sm'
                            : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                        } ${collapsed ? 'justify-center px-0' : ''}`}
                        title={collapsed ? item.label : undefined}>
                        <Icon size={15} className="shrink-0 opacity-70" />
                        {!collapsed && (
                          <>
                            <span className="flex-1">{item.label}</span>
                            {badge !== undefined && badge > 0 && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                                active ? 'bg-white/20 text-white' :
                                item.countKey === 'pool' ? 'bg-red-500/30 text-red-200' : 'bg-white/10 text-white/70'
                              }`}>
                                {badge > 99 ? '99+' : badge}
                              </span>
                            )}
                          </>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/5 p-3 space-y-1">
        {!collapsed && (
          <Link href="/perfil" className="flex items-center gap-2 text-[11px] text-white/40 hover:text-white/70 transition-colors px-1 py-1">
            <User size={12} />
            <span className="truncate">Perfil</span>
          </Link>
        )}
        <button onClick={toggle}
          className="flex items-center gap-2 text-[11px] text-white/40 hover:text-white/70 transition-colors w-full px-1 py-1">
          <Moon size={14} className={dark ? 'text-amber-400' : ''} />
          {!collapsed && 'Modo oscuro'}
        </button>
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 text-[11px] text-white/40 hover:text-red-400 transition-colors w-full px-1 py-1">
          <LogOut size={14} />
          {!collapsed && 'Salir'}
        </button>
      </div>
    </aside>
  );
}
