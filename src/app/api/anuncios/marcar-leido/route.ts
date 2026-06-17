/**
 * POST /api/anuncios/marcar-leido — Marcar anuncios como leídos
 * Body: { ids: number[] } o { anuncio_id: number }
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth } from '@/lib/auth-roles';

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const { ids, anuncio_id } = await req.json();
    const idList = ids || (anuncio_id ? [anuncio_id] : []);

    if (idList.length === 0) {
      return NextResponse.json({ error: 'Faltan ids o anuncio_id' }, { status: 400 });
    }

    for (const aid of idList) {
      await pool.query(
        `INSERT INTO anuncios_leidos (anuncio_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [aid, parseInt(userId)]
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === 'No autenticado') return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    console.error('[api/anuncios/marcar-leido]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
