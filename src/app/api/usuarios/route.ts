/**
 * app/api/usuarios/route.ts — CRUD de Usuarios
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

// GET — listar con filtros
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const equipo = searchParams.get('equipo');
  const supervisorId = searchParams.get('supervisor_id');
  const rol = searchParams.get('rol');

  let query = 'SELECT id, email, nombre, rol, equipo, activo, supervisor_id, ultima_conexion, created_at FROM usuarios WHERE 1=1';
  const params: any[] = [];
  let pi = 1;

  if (equipo) { params.push(equipo); query += ` AND equipo = $${pi++}`; }
  if (supervisorId) { params.push(parseInt(supervisorId)); query += ` AND supervisor_id = $${pi++}`; }
  if (rol) { params.push(rol); query += ` AND rol = $${pi++}`; }

  query += ' ORDER BY equipo NULLS LAST, rol, nombre';

  try {
    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST — crear usuario
export async function POST(req: Request) {
  try {
    const { email, nombre, password, rol, equipo, supervisor_id } = await req.json();
    if (!email || !nombre || !password || !rol) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 10);

    const { rows: [u] } = await pool.query(
      `INSERT INTO usuarios (email, nombre, password_hash, rol, equipo, supervisor_id, activo)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, email, nombre, rol, equipo, supervisor_id, activo`,
      [email, nombre, hash, rol, equipo || null, supervisor_id || null]
    );

    return NextResponse.json(u, { status: 201 });
  } catch (e: any) {
    if (e.code === '23505') return NextResponse.json({ error: 'Email ya existe' }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH — actualizar usuario
export async function PATCH(req: Request) {
  try {
    const { id, nombre, email, rol, equipo, supervisor_id, activo, password } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

    const updates: string[] = [];
    const params: any[] = [];
    let pi = 1;

    if (nombre) { updates.push(`nombre = $${pi++}`); params.push(nombre); }
    if (email) { updates.push(`email = $${pi++}`); params.push(email); }
    if (rol) { updates.push(`rol = $${pi++}`); params.push(rol); }
    if (equipo !== undefined) { updates.push(`equipo = $${pi++}`); params.push(equipo || null); }
    if (supervisor_id !== undefined) { updates.push(`supervisor_id = $${pi++}`); params.push(supervisor_id || null); }
    if (activo !== undefined) { updates.push(`activo = $${pi++}`); params.push(activo); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${pi++}`);
      params.push(hash);
    }

    if (updates.length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });

    updates.push(`updated_at = now()`);
    params.push(id);
    await pool.query(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = $${pi}`, params);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
