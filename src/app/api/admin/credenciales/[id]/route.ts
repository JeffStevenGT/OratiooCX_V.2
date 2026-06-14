/**
 * app/api/admin/credenciales/[id]/route.ts — PATCH/DELETE credencial individual
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole } from '@/lib/auth-roles';

// PATCH — actualizar (cambiar contraseña, activar/desactivar, marcar error)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('desarrollador', 'jefe_area');
    const { id } = await params;
    const { password, activo, ultimo_error } = await req.json();

    const updates: string[] = [];
    const vals: any[] = [];
    let pi = 1;

    if (password !== undefined) { updates.push(`password = $${pi++}`); vals.push(password); }
    if (activo !== undefined) { updates.push(`activo = $${pi++}`); vals.push(activo); }
    if (ultimo_error !== undefined) { updates.push(`ultimo_error = $${pi++}`); vals.push(ultimo_error); }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    vals.push(parseInt(id));
    await pool.query(
      `UPDATE credenciales_bot SET ${updates.join(', ')} WHERE id = $${pi}`,
      vals
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE — eliminar credencial
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('desarrollador', 'jefe_area');
    const { id } = await params;
    await pool.query('DELETE FROM credenciales_bot WHERE id = $1', [parseInt(id)]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
