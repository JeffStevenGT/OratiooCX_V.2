import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const { rows } = await pool.query(
    'SELECT id, email, nombre, rol, equipo, activo, ultima_conexion, created_at FROM usuarios ORDER BY id'
  );
  return NextResponse.json(rows);
}
