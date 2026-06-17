/**
 * app/api/usuarios/route.ts — CRUD de Usuarios
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { requireRole, requireAuth } from '@/lib/auth-roles';

// GET — listar (autenticado, scoped por rol)
export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const authRole = (session.user as any).role;
    const authEquipo = (session.user as any).team;
    const { searchParams } = new URL(req.url);
    const equipo = searchParams.get('equipo');
    const supervisorId = searchParams.get('supervisor_id');
    const rol = searchParams.get('rol');

    let query = 'SELECT id, email, nombre, rol, equipo, extension_vpbx, activo, supervisor_id, ultima_conexion, created_at, fecha_nacimiento FROM usuarios WHERE activo = true';
    const params: any[] = [];
    let pi = 1;

    if (equipo) { params.push(equipo); query += ` AND equipo = $${pi++}`; }
    if (supervisorId) { params.push(parseInt(supervisorId)); query += ` AND supervisor_id = $${pi++}`; }
    if (rol) { params.push(rol); query += ` AND rol = $${pi++}`; }

    const authUserId = (session.user as any).id;
    if (!['jefe_area', 'desarrollador', 'it'].includes(authRole)) {
      if (authRole === 'supervisor') {
        params.push(authEquipo);
        query += ` AND (equipo = $${pi++} OR id = $${pi++})`;
        params.push(parseInt(authUserId));
      } else {
        params.push(parseInt(authUserId));
        query += ` AND id = $${pi++}`;
      }
    }

    query += ` ORDER BY CASE equipo WHEN 'Administración' THEN 0 WHEN 'España' THEN 1 WHEN 'Perú' THEN 2 ELSE 3 END, equipo, rol, nombre LIMIT 200`;

    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (e: any) {
    if (e.message === 'No autenticado') return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    console.error('[api/usuarios]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST — crear usuario
export async function POST(req: Request) {
  try {
    await requireRole('jefe_area', 'desarrollador');
    const { email, nombre, password, rol, equipo, supervisor_id, fecha_nacimiento } = await req.json();
    if (!email || !nombre || !password || !rol) {
      return NextResponse.json({ error: 'Faltan campos: email, nombre, password, rol' }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 10);

    const { rows: [u] } = await pool.query(
      `INSERT INTO usuarios (email, nombre, password_hash, rol, equipo, supervisor_id, fecha_nacimiento, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING id, email, nombre, rol, equipo, supervisor_id, fecha_nacimiento, activo`,
      [email, nombre, hash, rol, equipo || null, supervisor_id || null, fecha_nacimiento || null]
    );

    return NextResponse.json(u, { status: 201 });
  } catch (e: any) {
    if (e.message === 'No autenticado') return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    if (e.message === 'No autorizado') return NextResponse.json({ error: 'Solo jefe_area o desarrollador pueden crear usuarios' }, { status: 403 });
    if (e.code === '23505') return NextResponse.json({ error: 'Email ya existe' }, { status: 409 });
    console.error('[api/usuarios]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PATCH — actualizar usuario
export async function PATCH(req: Request) {
  try {
    await requireRole('jefe_area', 'desarrollador');
    const { id, nombre, email, rol, equipo, supervisor_id, extension_vpbx, activo, password, fecha_nacimiento } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

    const updates: string[] = [];
    const params: any[] = [];
    let pi = 1;

    if (nombre !== undefined) { updates.push(`nombre = $${pi++}`); params.push(nombre); }
    if (email !== undefined) { updates.push(`email = $${pi++}`); params.push(email); }
    if (rol !== undefined) { updates.push(`rol = $${pi++}`); params.push(rol); }
    if (equipo !== undefined) { updates.push(`equipo = $${pi++}`); params.push(equipo || null); }
    if (supervisor_id !== undefined) { updates.push(`supervisor_id = $${pi++}`); params.push(supervisor_id ? parseInt(String(supervisor_id)) : null); }
    if (extension_vpbx !== undefined) { updates.push(`extension_vpbx = $${pi++}`); params.push(extension_vpbx || null); }
    if (fecha_nacimiento !== undefined) { updates.push(`fecha_nacimiento = $${pi++}`); params.push(fecha_nacimiento || null); }
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
    if (e.message === 'No autenticado') return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    if (e.message === 'No autorizado') return NextResponse.json({ error: 'Solo jefe_area o desarrollador pueden editar usuarios' }, { status: 403 });
    console.error('[api/usuarios]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE — eliminar permanentemente (hard delete)
export async function DELETE(req: Request) {
  try {
    await requireRole('jefe_area', 'desarrollador');
    const { id, hard } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

    if (hard) {
      // Eliminación física
      await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
      return NextResponse.json({ success: true, action: 'eliminado' });
    } else {
      // Suspensión (soft delete)
      await pool.query('UPDATE usuarios SET activo = false, updated_at = now() WHERE id = $1', [id]);
      return NextResponse.json({ success: true, action: 'suspendido' });
    }
  } catch (e: any) {
    if (e.message === 'No autenticado') return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    if (e.message === 'No autorizado') return NextResponse.json({ error: 'Solo jefe_area o desarrollador pueden eliminar usuarios' }, { status: 403 });
    if (e.code === '23503') return NextResponse.json({ error: 'No se puede eliminar: tiene pipeline, historial u otros registros. Usa Suspender en su lugar.' }, { status: 409 });
    console.error('[api/usuarios]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
