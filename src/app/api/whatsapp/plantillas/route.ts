/**
 * api/whatsapp/plantillas/route.ts — CRUD de plantillas WhatsApp
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole } from '@/lib/auth-roles';

// GET — listar activas (asesor) o todas (supervisor+)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const todas = searchParams.get('todas') === 'true';

    // Si pide todas, necesita ser supervisor+
    if (todas) await requireRole('supervisor', 'jefe_area', 'desarrollador');

    const query = todas
      ? `SELECT * FROM whatsapp_plantillas ORDER BY id`
      : `SELECT * FROM whatsapp_plantillas WHERE activo = true ORDER BY id`;

    const { rows } = await pool.query(query);
    return NextResponse.json(rows);
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST — crear/actualizar (supervisor+)
export async function POST(req: Request) {
  try {
    await requireRole('supervisor', 'jefe_area', 'desarrollador');
    const { id, nombre, titulo, mensaje, variables, activo } = await req.json();

    if (id) {
      // Update
      const updates: string[] = [];
      const vals: any[] = [];
      let pi = 1;
      if (nombre) { updates.push(`nombre = $${pi++}`); vals.push(nombre); }
      if (titulo) { updates.push(`titulo = $${pi++}`); vals.push(titulo); }
      if (mensaje) { updates.push(`mensaje = $${pi++}`); vals.push(mensaje); }
      if (variables) { updates.push(`variables = $${pi++}`); vals.push(variables); }
      if (activo !== undefined) { updates.push(`activo = $${pi++}`); vals.push(activo); }
      if (updates.length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
      vals.push(id);
      await pool.query(`UPDATE whatsapp_plantillas SET ${updates.join(', ')} WHERE id = $${pi}`, vals);
    } else {
      // Create
      if (!nombre || !mensaje) return NextResponse.json({ error: 'Faltan nombre y mensaje' }, { status: 400 });
      const { rows: [p] } = await pool.query(
        `INSERT INTO whatsapp_plantillas (nombre, titulo, mensaje, variables)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [nombre, titulo || nombre, mensaje, variables || []]
      );
      return NextResponse.json(p, { status: 201 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
