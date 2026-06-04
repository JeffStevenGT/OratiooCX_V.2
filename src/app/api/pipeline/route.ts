/**
 * app/api/pipeline/route.ts — Pipeline: asignar leads, listar, liberar
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole } from '@/lib/auth-roles';

// GET — leads sin asignar (pool), filtrable
export async function GET(req: Request) {
  try {
    await requireRole('jefe_area', 'supervisor', 'desarrollador');
    const { searchParams } = new URL(req.url);
    const cima = searchParams.get('cima');
    const renove = searchParams.get('renove');
    const fecha = searchParams.get('fecha');
    const limit = parseInt(searchParams.get('limit') || '200');

    let query = `
      SELECT c.id_cliente, c.numero_documento as dni,
             COALESCE(NULLIF(c.nombre_razon_social, ''), cp.datos->'header'->>'nombre', 'Sin nombre') as nombre,
             CASE WHEN (cp.datos->>'cima_global')::boolean THEN 'SI' ELSE 'NO' END as cima,
             cp.ultima_extraccion
      FROM clientes c
      JOIN clientes_proyectos cp ON c.id_cliente = cp.id_cliente
        AND cp.proyecto_id = (SELECT id FROM proyectos WHERE nombre = 'orange')
        AND cp.datos->>'estado' IN ('completado', 'no_cliente')
      LEFT JOIN pipeline pl ON c.id_cliente = pl.id_cliente
        AND pl.proyecto_id = (SELECT id FROM proyectos WHERE nombre = 'orange')
        AND pl.deleted_at IS NULL
      WHERE pl.id IS NULL
    `;
    const params: any[] = [];
    let pi = 1;

    if (cima === 'true') {
      query += ` AND (cp.datos->>'cima_global')::boolean = true`;
    } else if (cima === 'false') {
      query += ` AND ((cp.datos->>'cima_global')::boolean = false OR cp.datos->>'cima_global' IS NULL)`;
    }

    if (fecha) {
      params.push(fecha);
      query += ` AND cp.ultima_extraccion::date = $${pi++}::date`;
    }

    query += ` ORDER BY cp.ultima_extraccion DESC LIMIT $${pi++}`;
    params.push(limit);

    const { rows } = await pool.query(query, params);

    // Enriquecer con info de renove
    const leads = rows.map((r: any) => {
      const lineas = (r.datos?.lineas) || [];
      const tieneRenove = lineas.some((l: any) => l.tiene_renove);
      const PRIORIDAD = ['Renove mixto al mejor precio con máximo descuento', 'Renove mixto al mejor precio con descuento', 'Renove mixto al mejor precio', 'Renove mixto'];
      let variante = 'N/A';
      if (tieneRenove) {
        for (const p of PRIORIDAD) {
          const m = lineas.find((l: any) => l.variante_renove === p);
          if (m) { variante = p; break; }
        }
      }
      return { ...r, tiene_renove: tieneRenove, renove_variante: variante, lineas_count: lineas.length };
    });

    // Filtrar renove en JS (más simple que en SQL con JSONB anidado)
    let result = leads;
    if (renove === 'true') result = result.filter((l: any) => l.tiene_renove);
    else if (renove === 'false') result = result.filter((l: any) => !l.tiene_renove);

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST — asignar leads
export async function POST(req: Request) {
  try {
    await requireRole('jefe_area', 'supervisor', 'desarrollador');
    const { leads, asesor_id } = await req.json();
    if (!leads?.length || !asesor_id) {
      return NextResponse.json({ error: 'Faltan leads o asesor_id' }, { status: 400 });
    }

    const proyectoId = 1; // orange
    const ids = Array.isArray(leads) ? leads : [leads];

    for (const id_cliente of ids) {
      await pool.query(
        `INSERT INTO pipeline (id_cliente, proyecto_id, asesor_id, estado, ultimo_cambio)
         VALUES ($1, $2, $3, 'pendiente', now())
         ON CONFLICT (id_cliente, proyecto_id, asesor_id) WHERE deleted_at IS NULL
         DO NOTHING`,
        [id_cliente, proyectoId, asesor_id]
      );

      // Historial
      await pool.query(
        `INSERT INTO historial (id_cliente, tipo, proyecto_id, asesor_id, descripcion)
         VALUES ($1, 'asignacion', $2, $3, 'Lead asignado a asesor')`,
        [id_cliente, proyectoId, asesor_id]
      );
    }

    return NextResponse.json({ success: true, count: ids.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE — liberar lead (soft delete)
export async function DELETE(req: Request) {
  try {
    const { id_cliente } = await req.json();
    if (!id_cliente) return NextResponse.json({ error: 'Falta id_cliente' }, { status: 400 });

    const proyectoId = 1;
    await pool.query(
      `UPDATE pipeline SET deleted_at = now()
       WHERE id_cliente = $1 AND proyecto_id = $2 AND deleted_at IS NULL`,
      [id_cliente, proyectoId]
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH — actualizar estado de pipeline
export async function PATCH(req: Request) {
  try {
    const { id, estado, notas } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

    const updates = ['ultimo_cambio = now()'];
    const params: any[] = [];
    let pi = 1;
    if (estado) { updates.push(`estado = $${pi++}`); params.push(estado); }
    if (notas !== undefined) { updates.push(`notas = $${pi++}`); params.push(notas); }
    params.push(id);

    await pool.query(`UPDATE pipeline SET ${updates.join(', ')} WHERE id = $${pi} AND deleted_at IS NULL`, params);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
