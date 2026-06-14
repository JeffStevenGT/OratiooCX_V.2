/**
 * app/api/pipeline/tramitacion/route.ts — Ventas pendientes de tramitar
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tramitados = searchParams.get('tramitados') === 'true';
    const estado = tramitados ? 'tramitado' : 'venta';
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
      WHERE pl.estado = $1
        AND pl.deleted_at IS NULL
      ORDER BY pl.ultimo_cambio DESC
      LIMIT 100
    `, [estado]);
    return NextResponse.json(rows);
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
