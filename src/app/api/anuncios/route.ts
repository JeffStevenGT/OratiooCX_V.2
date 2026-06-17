/**
 * app/api/anuncios/route.ts — CRUD de Anuncios
 * GET: listar anuncios (filtrables por proyecto, tipo, activo)
 * POST: crear anuncio (supervisor, jefe_area, back_office, auditor_calidad, it, desarrollador)
 * PATCH: actualizar anuncio (activo, roles_visibles, etc.)
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole, requireAuth } from '@/lib/auth-roles';

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get('proyecto_id') || '1';
    const soloActivos = searchParams.get('activos') !== 'false';
    const tipo = searchParams.get('tipo') || '';

    let query = `
      SELECT a.*, u.nombre as creador_nombre
      FROM anuncios a
      LEFT JOIN usuarios u ON a.creado_por = u.id
      WHERE a.proyecto_id = $1
    `;
    const params: any[] = [parseInt(proyectoId)];
    let pi = 2;

    if (soloActivos) {
      query += ` AND a.activo = true`;
    }
    if (tipo) {
      query += ` AND a.tipo = $${pi++}`;
      params.push(tipo);
    }

    query += ` ORDER BY a.created_at DESC LIMIT 100`;

    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (e: any) {
    if (e.message === 'No autenticado') return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    console.error('[api/anuncios]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole('supervisor', 'jefe_area', 'back_office', 'auditor_calidad', 'it', 'desarrollador');
    const userId = (session.user as any).id;
    const { proyecto_id, titulo, mensaje, tipo, roles_visibles } = await req.json();

    if (!titulo) return NextResponse.json({ error: 'Falta titulo' }, { status: 400 });

    const { rows: [a] } = await pool.query(
      `INSERT INTO anuncios (proyecto_id, titulo, mensaje, tipo, roles_visibles, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        proyecto_id || 1,
        titulo,
        mensaje || '',
        tipo || 'general',
        roles_visibles || ['asesor', 'supervisor', 'jefe_area', 'back_office', 'auditor_calidad', 'it', 'desarrollador'],
        parseInt(userId),
      ]
    );

    return NextResponse.json(a, { status: 201 });
  } catch (e: any) {
    if (e.message === 'No autenticado') return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    if (e.message === 'No autorizado') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    console.error('[api/anuncios]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireRole('supervisor', 'jefe_area', 'back_office', 'auditor_calidad', 'it', 'desarrollador');
    const { id, titulo, mensaje, tipo, roles_visibles, activo } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

    const updates: string[] = [];
    const params: any[] = [];
    let pi = 1;

    if (titulo !== undefined) { updates.push(`titulo = $${pi++}`); params.push(titulo); }
    if (mensaje !== undefined) { updates.push(`mensaje = $${pi++}`); params.push(mensaje); }
    if (tipo !== undefined) { updates.push(`tipo = $${pi++}`); params.push(tipo); }
    if (roles_visibles !== undefined) { updates.push(`roles_visibles = $${pi++}`); params.push(roles_visibles); }
    if (activo !== undefined) { updates.push(`activo = $${pi++}`); params.push(activo); }

    if (updates.length === 0) return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });

    params.push(id);
    await pool.query(
      `UPDATE anuncios SET ${updates.join(', ')} WHERE id = $${pi}`,
      params
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === 'No autenticado') return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    if (e.message === 'No autorizado') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    console.error('[api/anuncios]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
