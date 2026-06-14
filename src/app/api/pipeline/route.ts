/**
 * app/api/pipeline/route.ts — Pipeline: asignar leads, listar, liberar
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole, requirePipelineOwnership } from '@/lib/auth-roles';

// GET — leads: pool (CEO) o asignados (jefe/supervisor)
export async function GET(req: Request) {
  try {
    const session = await requireRole('jefe_area', 'supervisor', 'desarrollador');
    const userRole = (session.user as any).role;
    const uid = parseInt((session.user as any).id);
    const { searchParams } = new URL(req.url);
    const cima = searchParams.get('cima');
    const renove = searchParams.get('renove');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const limit = parseInt(searchParams.get('limit') || '200');

    const params: any[] = [];
    let pi = 1;

    let query: string;
    if (userRole === 'desarrollador') {
      // CEO: ve todo el pool sin asignar
      query = `
        SELECT c.id_cliente, c.numero_documento as dni,
               COALESCE(NULLIF(c.nombre_razon_social, ''), cp.datos->'header'->>'nombre', '—') as nombre,
               CASE WHEN (cp.datos->>'cima_global')::boolean THEN 'SI' ELSE 'NO' END as cima,
               cp.datos,
               cp.ultima_extraccion
        FROM clientes c
        JOIN clientes_proyectos cp ON c.id_cliente = cp.id_cliente
          AND cp.proyecto_id = (SELECT id FROM proyectos WHERE nombre = 'orange')
          AND cp.datos->>'estado' = 'completado'
        LEFT JOIN pipeline pl ON c.id_cliente = pl.id_cliente
          AND pl.proyecto_id = (SELECT id FROM proyectos WHERE nombre = 'orange')
          AND pl.deleted_at IS NULL
        WHERE pl.id IS NULL
      `;
    } else {
      // Jefe/Supervisor: solo ve leads que le fueron asignados
      query = `
        SELECT c.id_cliente, c.numero_documento as dni,
               COALESCE(NULLIF(c.nombre_razon_social, ''), cp.datos->'header'->>'nombre', '—') as nombre,
               CASE WHEN (cp.datos->>'cima_global')::boolean THEN 'SI' ELSE 'NO' END as cima,
               cp.datos,
               cp.ultima_extraccion
        FROM clientes c
        JOIN clientes_proyectos cp ON c.id_cliente = cp.id_cliente
          AND cp.proyecto_id = (SELECT id FROM proyectos WHERE nombre = 'orange')
          AND cp.datos->>'estado' = 'completado'
        JOIN pipeline pl ON c.id_cliente = pl.id_cliente
          AND pl.proyecto_id = (SELECT id FROM proyectos WHERE nombre = 'orange')
          AND pl.deleted_at IS NULL
          AND pl.asesor_id = $${pi++} AND pl.estado = 'pendiente'
      `;
      params.push(uid);
    }

    if (cima === 'true') {
      query += ` AND (cp.datos->>'cima_global')::boolean = true`;
    } else if (cima === 'false') {
      query += ` AND ((cp.datos->>'cima_global')::boolean = false OR cp.datos->>'cima_global' IS NULL)`;
    }

    if (fechaDesde) {
      params.push(fechaDesde);
      query += ` AND cp.ultima_extraccion::date >= $${pi++}::date`;
    }
    if (fechaHasta) {
      params.push(fechaHasta);
      query += ` AND cp.ultima_extraccion::date <= $${pi++}::date`;
    }

    query += ` ORDER BY cp.ultima_extraccion DESC LIMIT $${pi++}`;
    params.push(limit);

    const { rows } = await pool.query(query, params);

    // Enriquecer con info de renove
    const leads = rows.map((r: any) => {
      const lineas = (r.datos?.lineas) || [];
      const tieneRenove = lineas.some((l: any) => l.tiene_renove);
      const PRIORIDAD = [
        'Renove mixto al mejor precio con máximo descuento',
        'Renove mixto al mejor precio con descuento',
        'Renove mixto al mejor precio',
        'Renove mixto',
        'Renove Multidispositivo',
      ];
      let variante = 'N/A';
      if (tieneRenove) {
        for (const p of PRIORIDAD) {
          const m = lineas.find((l: any) => l.variante_renove === p);
          if (m) { variante = p; break; }
        }
        // Fallback: si no coincidió con las conocidas, usar la primera variante no N/A
        if (variante === 'N/A') {
          const otra = lineas.find((l: any) => l.variante_renove && l.variante_renove !== 'N/A');
          if (otra) variante = otra.variante_renove;
        }
      }
      return { ...r, tiene_renove: tieneRenove, renove_variante: variante, lineas_count: lineas.length };
    });

    // Filtrar renove en JS (más simple que en SQL con JSONB anidado)
    let result = leads;
    if (renove === 'true') result = result.filter((l: any) => l.tiene_renove);
    else if (renove === 'false') result = result.filter((l: any) => !l.tiene_renove);

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST — asignar/reasignar leads (round-robin si múltiples asesores)
export async function POST(req: Request) {
  try {
    const session = await requireRole('jefe_area', 'supervisor', 'desarrollador');
    const userRole = (session.user as any).role;
    const uid = parseInt((session.user as any).id);
    const { leads, asesor_id, asesores, proyecto_id } = await req.json();
    const ids = Array.isArray(leads) ? leads : [leads];
    if (!ids.length) return NextResponse.json({ error: 'Faltan leads' }, { status: 400 });

    let asignaciones: { id_cliente: string; asesor_id: number }[] = [];
    if (asesores && Array.isArray(asesores) && asesores.length > 0) {
      ids.forEach((id_cliente, i) => {
        asignaciones.push({ id_cliente, asesor_id: asesores[i % asesores.length] });
      });
    } else if (asesor_id) {
      ids.forEach(id_cliente => asignaciones.push({ id_cliente, asesor_id }));
    } else {
      return NextResponse.json({ error: 'Falta asesor_id o asesores' }, { status: 400 });
    }

    const proyectoId = proyecto_id || 1;
    let asignados = 0;

    if (userRole === 'desarrollador') {
      // CEO: INSERT nuevos registros (leads vienen del pool)
      for (const a of asignaciones) {
        const { rowCount } = await pool.query(
          `INSERT INTO pipeline (id_cliente, proyecto_id, asesor_id, estado, ultimo_cambio)
           VALUES ($1, $2, $3, 'pendiente', now())
           ON CONFLICT (id_cliente, proyecto_id, asesor_id) WHERE deleted_at IS NULL
           DO NOTHING`,
          [a.id_cliente, proyectoId, a.asesor_id]
        );
        if ((rowCount ?? 0) > 0) {
          asignados++;
          await pool.query(
            `INSERT INTO historial (id_cliente, tipo, proyecto_id, asesor_id, descripcion)
             VALUES ($1, 'asignacion', $2, $3, 'Lead asignado')`,
            [a.id_cliente, proyectoId, a.asesor_id]
          );
        }
      }
    } else {
      // Jefe/Supervisor: REASIGNAR leads que ya les pertenecen
      for (const a of asignaciones) {
        const { rowCount } = await pool.query(
          `UPDATE pipeline
           SET asesor_id = $1, ultimo_cambio = now()
           WHERE id_cliente = $2
             AND proyecto_id = $3
             AND asesor_id = $4
             AND estado = 'pendiente'
             AND deleted_at IS NULL`,
          [a.asesor_id, a.id_cliente, proyectoId, uid]
        );
        if ((rowCount ?? 0) > 0) {
          asignados++;
          await pool.query(
            `INSERT INTO historial (id_cliente, tipo, proyecto_id, asesor_id, descripcion)
             VALUES ($1, 'reasignacion', $2, $3, 'Lead reasignado')`,
            [a.id_cliente, proyectoId, a.asesor_id]
          );
        }
      }
    }

    return NextResponse.json({ success: true, count: ids.length, asignados });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE — liberar lead (soft delete)
export async function DELETE(req: Request) {
  try {
    const { id_cliente, proyecto_id } = await req.json();
    if (!id_cliente) return NextResponse.json({ error: 'Falta id_cliente' }, { status: 400 });

    const proyectoId = proyecto_id || 1;
    await pool.query(
      `UPDATE pipeline SET deleted_at = now()
       WHERE id_cliente = $1 AND proyecto_id = $2 AND deleted_at IS NULL`,
      [id_cliente, proyectoId]
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PATCH — actualizar estado de pipeline
export async function PATCH(req: Request) {
  try {
    const { id, estado, notas } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

    // Verificar ownership
    await requirePipelineOwnership(id);

    const updates = ['ultimo_cambio = now()'];
    const params: any[] = [];
    let pi = 1;
    if (estado) { updates.push(`estado = $${pi++}`); params.push(estado); }
    if (notas !== undefined) { updates.push(`notas = $${pi++}`); params.push(notas); }
    params.push(id);

    await pool.query(`UPDATE pipeline SET ${updates.join(', ')} WHERE id = $${pi} AND deleted_at IS NULL`, params);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
