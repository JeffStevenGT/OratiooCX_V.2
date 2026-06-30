/**
 * app/api/auditoria/route.ts — Historial completo del sistema
 */

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-roles';
import pool from '@/lib/db';

export async function GET(req: Request) {
  await requireRole('supervisor', 'jefe_area', 'desarrollador');
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get('tipo');
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const limit = parseInt(searchParams.get('limit') || '200');
  const where: string[] = [];
  const params: any[] = [];
  let pi = 1;

  if (tipo) { where.push(`h.tipo = $${pi++}`); params.push(tipo); }
  if (desde) { where.push(`h.created_at::date >= $${pi++}`); params.push(desde); }
  if (hasta) { where.push(`h.created_at::date <= $${pi++}`); params.push(hasta); }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  let query = `
    SELECT h.*, c.numero_documento as dni, c.nombre_razon_social as nombre_cliente,
           u.nombre as asesor_nombre
    FROM historial h
    JOIN clientes c ON h.id_cliente = c.id_cliente
    JOIN clientes_proyectos cp ON h.id_cliente = cp.id_cliente AND h.proyecto_id = cp.proyecto_id
    LEFT JOIN usuarios u ON h.asesor_id = u.id
    ${whereClause}
    AND cp.datos->>'estado' IN ('completado','no_cliente','sin_datos','no_cargable','error')
    ORDER BY h.created_at DESC LIMIT $${pi++}
  `;
  params.push(limit);

  try {
    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
