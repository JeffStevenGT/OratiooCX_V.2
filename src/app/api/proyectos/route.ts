import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const { rows } = await pool.query('SELECT * FROM proyectos ORDER BY id');
  return NextResponse.json(rows);
}

export async function PATCH(req: Request) {
  const { id, activo, nombre_visible } = await req.json();
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const updates: string[] = [];
  const params: any[] = [];
  let pi = 1;
  if (activo !== undefined) { updates.push(`activo = $${pi++}`); params.push(activo); }
  if (nombre_visible) { updates.push(`nombre_visible = $${pi++}`); params.push(nombre_visible); }
  if (!updates.length) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });

  params.push(id);
  await pool.query(`UPDATE proyectos SET ${updates.join(', ')} WHERE id = $${pi}`, params);
  return NextResponse.json({ success: true });
}

export async function POST(req: Request) {
  const { nombre, nombre_visible, activo } = await req.json();
  if (!nombre || !nombre_visible) return NextResponse.json({ error: 'Falta nombre' }, { status: 400 });
  const { rows: [p] } = await pool.query(
    `INSERT INTO proyectos (nombre, nombre_visible, activo) VALUES ($1, $2, $3) RETURNING *`,
    [nombre, nombre_visible, activo !== false]
  );
  return NextResponse.json(p, { status: 201 });
}
