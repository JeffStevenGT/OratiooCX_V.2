/**
 * app/api/auditoria/route.ts — Historial completo del sistema
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get('tipo');
  const limit = parseInt(searchParams.get('limit') || '100');

  let query = `
    SELECT h.*, c.numero_documento as dni, c.nombre_razon_social as nombre_cliente,
           u.nombre as asesor_nombre
    FROM historial h
    JOIN clientes c ON h.id_cliente = c.id_cliente
    LEFT JOIN usuarios u ON h.asesor_id = u.id
  `;
  const params: any[] = [];
  let pi = 1;

  if (tipo) { params.push(tipo); query += ` WHERE h.tipo = $${pi++}`; }

  query += ` ORDER BY h.created_at DESC LIMIT $${pi++}`;
  params.push(limit);

  try {
    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
