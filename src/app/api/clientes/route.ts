import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT id_cliente, tipo_documento, numero_documento, nombre_razon_social, tipo_persona, cnae
       FROM clientes
       ORDER BY created_at DESC
       LIMIT 100`
    );
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
