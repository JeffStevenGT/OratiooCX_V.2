/**
 * lib/auth-roles.ts — Verificación de roles por API
 */

import { auth } from '@/lib/auth';

export async function requireRole(...roles: string[]) {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');
  const userRole = (session.user as any).role || 'asesor';
  if (!roles.includes(userRole)) throw new Error('No autorizado');
  return session;
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');
  return session;
}
