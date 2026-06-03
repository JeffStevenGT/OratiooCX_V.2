import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const equipo = searchParams.get('equipo');
  const supervisorId = searchParams.get('supervisor_id');
  const rol = searchParams.get('rol');

  let query = 'SELECT id, email, nombre, rol, equipo, activo, supervisor_id, ultima_conexion, created_at FROM usuarios WHERE activo = true';
  const params: any[] = [];
  let pi = 1;

  if (equipo) {
    params.push(equipo);
    query += ` AND equipo = $${pi++}`;
  }

  if (supervisorId) {
    params.push(parseInt(supervisorId));
    query += ` AND supervisor_id = $${pi++}`;
  }

  if (rol) {
    params.push(rol);
    query += ` AND rol = $${pi++}`;
  }

  query += ' ORDER BY equipo, rol, nombre';

  try {
    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
