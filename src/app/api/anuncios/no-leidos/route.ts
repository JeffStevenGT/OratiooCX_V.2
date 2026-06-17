/**
 * GET /api/anuncios/no-leidos — Anuncios no leídos para el usuario actual
 * Filtrados por proyecto_id y roles_visibles del usuario
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/auth-roles';

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const userRole = (session.user as any).role || 'asesor';
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get('proyecto_id') || '1';

    const { rows } = await pool.query(`
      SELECT a.*, u.nombre as creador_nombre
      FROM anuncios a
      LEFT JOIN usuarios u ON a.creado_por = u.id
      WHERE a.proyecto_id = $1
        AND a.activo = true
        AND $2 = ANY(a.roles_visibles)
        AND NOT EXISTS (
          SELECT 1 FROM anuncios_leidos al
          WHERE al.anuncio_id = a.id AND al.user_id = $3
        )
      ORDER BY a.created_at DESC
    `, [parseInt(proyectoId), userRole, parseInt(userId)]);

    return NextResponse.json(rows);
  } catch (e: any) {
    if (e.message === 'No autenticado') return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    console.error('[api/anuncios/no-leidos]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
