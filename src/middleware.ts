/**
 * middleware.ts — Protección de Rutas por Rol
 * =============================================
 * Redirecciona a /login si no hay sesión.
 * Protege rutas por rol.
 */

import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

// Mapa de rutas protegidas por rol
const ROLE_ROUTES: Record<string, string[]> = {
  '/asesor': ['asesor'],
  '/supervisor': ['supervisor'],
  '/jefe': ['jefe_area'],
  '/backoffice': ['back_office'],
  '/admin': ['it', 'desarrollador'],
  '/clientes': ['supervisor', 'jefe_area', 'it', 'desarrollador'],
  '/proyectos': ['jefe_area', 'desarrollador'],
  '/tramitacion': ['back_office'],
  '/usuarios': ['jefe_area', 'desarrollador'],
  '/infraestructura': ['it', 'desarrollador'],
  '/bots': ['it', 'desarrollador'],
  '/documentos': ['supervisor', 'jefe_area', 'it', 'desarrollador'],
};

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const session = req.auth;
  const userRole = (session?.user as any)?.role;

  // Rutas públicas
  if (path === '/login' || path.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Redirigir a login si no hay sesión
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Verificar permisos de rol
  const allowedRoles = ROLE_ROUTES[path];
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    // Redirigir al dashboard del rol correspondiente
    const redirectMap: Record<string, string> = {
      asesor: '/asesor',
      supervisor: '/supervisor',
      jefe_area: '/jefe',
      back_office: '/backoffice',
      it: '/admin',
      desarrollador: '/admin',
    };
    const redirect = redirectMap[userRole] || '/login';
    return NextResponse.redirect(new URL(redirect, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
