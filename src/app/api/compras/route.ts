/**
 * api/compras/route.ts — CRUD de compras + integración SICA
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole } from '@/lib/auth-roles';

export async function GET(req: Request) {
  try {
    await requireRole('supervisor', 'jefe_area', 'desarrollador');
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get('proyecto_id') || '1';
    const desde = searchParams.get('desde') || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const hasta = searchParams.get('hasta') || new Date().toISOString().split('T')[0];
    const asesorId = searchParams.get('asesor_id') || '';

    let query = `
      SELECT co.*, c.nombre_razon_social, u.nombre as asesor_nombre
      FROM compras co
      JOIN clientes c ON co.id_cliente = c.id_cliente
      LEFT JOIN usuarios u ON co.asesor_id = u.id
      WHERE co.proyecto_id = $1
        AND co.deleted_at IS NULL
        AND co.fecha_compra BETWEEN $2 AND $3
    `;
    const params: any[] = [proyectoId, desde, hasta];

    if (asesorId) {
      params.push(parseInt(asesorId));
      query += ` AND co.asesor_id = $${params.length}`;
    }
    query += ` ORDER BY co.fecha_compra DESC, co.created_at DESC LIMIT 200`;

    const { rows } = await pool.query(query, params);

    // Resumen
    const { rows: [resumen] } = await pool.query(`
      SELECT
        COUNT(*)::int as total_compras,
        COALESCE(SUM(importe), 0)::numeric as importe_total,
        COALESCE(SUM(comision_estimada), 0)::numeric as comision_total,
        COUNT(DISTINCT asesor_id)::int as asesores_con_venta
      FROM compras
      WHERE deleted_at IS NULL AND proyecto_id = $1 AND fecha_compra BETWEEN $2 AND $3
      ${asesorId ? ` AND asesor_id = $${params.length}` : ''}
    `, asesorId ? [...params.slice(0, 2), parseInt(asesorId)] : [proyectoId, desde, hasta]);

    return NextResponse.json({ compras: rows, resumen });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireRole('supervisor', 'jefe_area', 'desarrollador');
    const body = await req.json();
    const { id_cliente, proyecto_id, fecha_compra, tipo_producto, numero_linea, importe, comision_estimada, notas, asesor_id } = body;

    if (!id_cliente || !proyecto_id) {
      return NextResponse.json({ error: 'id_cliente y proyecto_id requeridos' }, { status: 400 });
    }

    const { rows: [compra] } = await pool.query(
      `INSERT INTO compras (id_cliente, proyecto_id, fecha_compra, tipo_producto, numero_linea, importe, comision_estimada, notas, asesor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id_cliente, proyecto_id, fecha_compra || new Date().toISOString().split('T')[0],
       tipo_producto, numero_linea, importe, comision_estimada, notas, asesor_id]
    );

    return NextResponse.json({ compra }, { status: 201 });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  try {
    await requireRole('supervisor', 'jefe_area', 'desarrollador');
    await pool.query('UPDATE compras SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL', [parseInt(id)]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
