/**
 * app/api/pipeline/tramitacion/route.ts — Ventas pendientes de tramitar
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT pl.id, pl.id_cliente, c.numero_documento as dni,
             COALESCE(c.nombre_razon_social, 'Sin nombre') as nombre,
             u.nombre as asesor, pl.ultimo_cambio,
             cp.datos->'header'->>'paquete' as paquete
      FROM pipeline pl
      JOIN clientes c ON pl.id_cliente = c.id_cliente
      JOIN usuarios u ON pl.asesor_id = u.id
      LEFT JOIN clientes_proyectos cp ON c.id_cliente = cp.id_cliente
        AND cp.proyecto_id = pl.proyecto_id
      WHERE pl.estado = 'venta'
        AND pl.deleted_at IS NULL
      ORDER BY pl.ultimo_cambio DESC
      LIMIT 100
    `);
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
