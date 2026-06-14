/**
 * app/api/admin/credenciales/route.ts — CRUD credenciales del bot
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole } from '@/lib/auth-roles';

// GET — listar todas (admin/desarrollador)
export async function GET() {
  try {
    await requireRole('desarrollador', 'jefe_area');
    const { rows } = await pool.query(
      `SELECT id, usuario, activo, ultimo_error, ultimo_uso, created_at
       FROM credenciales_bot ORDER BY id`
    );
    return NextResponse.json(rows);
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST — agregar credencial
export async function POST(req: Request) {
  try {
    await requireRole('desarrollador', 'jefe_area');
    const { usuario, password } = await req.json();
    if (!usuario || !password) {
      return NextResponse.json({ error: 'Faltan usuario y password' }, { status: 400 });
    }

    const { rows: [c] } = await pool.query(
      `INSERT INTO credenciales_bot (usuario, password) VALUES ($1, $2)
       RETURNING id, usuario, activo, created_at`,
      [usuario, password]
    );
    return NextResponse.json(c, { status: 201 });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
