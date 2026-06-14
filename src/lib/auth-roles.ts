/**
 * lib/auth-roles.ts — Verificación de roles por API
 */

import { auth } from '@/lib/auth';
import pool from '@/lib/db';

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

/**
 * Verifica que el usuario autenticado sea dueño del registro en pipeline.
 * Asesor → solo sus leads. Supervisor/jefe/dev → cualquier lead.
 */
export async function requirePipelineOwnership(pipelineId: number) {
  const session = await requireAuth();
  const userId = (session.user as any).id;
  const userRole = (session.user as any).role || 'asesor';

  // Supervisores, jefes y devs pueden modificar cualquier lead
  if (['supervisor', 'jefe_area', 'desarrollador', 'it'].includes(userRole)) {
    return session;
  }

  // Asesor: verificar que el lead le pertenece
  const { rows } = await pool.query(
    `SELECT id FROM pipeline WHERE id = $1 AND asesor_id = $2 AND deleted_at IS NULL`,
    [pipelineId, parseInt(userId)]
  );
  if (rows.length === 0) {
    throw new Error('No autorizado: este lead no te pertenece');
  }
  return session;
}
