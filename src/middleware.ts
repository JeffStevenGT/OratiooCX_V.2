/**
 * middleware.ts — Protección de rutas por autenticación
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rutas públicas (no requieren login)
  if (
    pathname === '/login' ||
    pathname === '/inicio' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/api/bot/') ||
    pathname.startsWith('/api/internal/') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Verificar autenticación
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Edge case: usuario desactivado con JWT aún válido
  if ((token as any).activo === false) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('error', 'inactive');
    return NextResponse.redirect(loginUrl);
  }

  // Protección de rutas por rol
  const role = token.role as string;

  const roleRoutes: Record<string, string[]> = {
    '/jefe': ['jefe_area', 'desarrollador'],
    '/admin': ['it', 'desarrollador'],
    '/supervisor': ['supervisor', 'jefe_area', 'desarrollador'],
    '/asesor': ['asesor', 'supervisor', 'jefe_area', 'desarrollador'],
    '/backoffice': ['back_office', 'jefe_area', 'desarrollador'],
    '/asignar-leads': ['jefe_area', 'supervisor', 'desarrollador'],
    '/estadisticas': ['supervisor', 'jefe_area', 'desarrollador'],
    '/auditoria': ['supervisor', 'jefe_area', 'desarrollador'],
    '/calidad': ['auditor_calidad', 'supervisor', 'jefe_area', 'desarrollador'],
    '/usuarios': ['jefe_area', 'desarrollador'],
    '/infraestructura': ['it', 'desarrollador'],
    '/bots': ['it', 'desarrollador'],
    '/config': ['it', 'desarrollador'],
    '/proyectos': ['jefe_area', 'desarrollador'],
    '/metas': ['supervisor', 'jefe_area', 'desarrollador'],
    '/alertas': ['supervisor', 'jefe_area', 'desarrollador'],
    '/clientes': ['supervisor', 'jefe_area', 'it', 'desarrollador', 'back_office'],
    '/power-dialer': ['asesor', 'supervisor', 'jefe_area', 'desarrollador'],
    '/vpbx': ['supervisor', 'jefe_area', 'desarrollador', 'it'],
    '/rendimiento': ['supervisor', 'jefe_area', 'desarrollador'],
    '/inteligencia': ['supervisor', 'jefe_area', 'desarrollador'],
    '/fichaje': ['asesor', 'supervisor', 'jefe_area', 'back_office', 'it', 'desarrollador'],
    '/perfil': ['asesor', 'supervisor', 'jefe_area', 'back_office', 'it', 'desarrollador', 'auditor_calidad'],
    '/wikiratioo': ['asesor', 'supervisor', 'jefe_area', 'back_office', 'it', 'desarrollador', 'auditor_calidad'],
    '/backoffice/tramitacion': ['back_office', 'jefe_area', 'desarrollador'],
  };

  // Verificar ruta específica
  for (const [route, roles] of Object.entries(roleRoutes)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      if (!roles.includes(role)) {
        // Redirigir a inicio si no tiene permiso
        return NextResponse.redirect(new URL('/inicio', req.url));
      }
      break;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
