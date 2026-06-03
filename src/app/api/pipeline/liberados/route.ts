/**
 * app/api/pipeline/liberados/route.ts — Leads liberados
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (h.id_cliente)
        c.id_cliente, c.numero_documento as dni,
        c.nombre_razon_social as nombre,
        h.datos->>'asesor_anterior' as asesor_anterior,
        h.created_at as liberado_at
      FROM historial h
      JOIN clientes c ON h.id_cliente = c.id_cliente
      WHERE h.tipo = 'liberacion'
      ORDER BY h.id_cliente, h.created_at DESC
      LIMIT 50
    `);
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
