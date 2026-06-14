/**
 * app/api/pipeline/mine/route.ts — Mis leads (asesor)
 * 
 * Usa la sesión de NextAuth para identificar al usuario.
 * Acepta ?user_id=X solo si es supervisor/jefe/dev (para ver leads de otro).
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const sessionUserId = parseInt((session.user as any).id);
  const userRole = (session.user as any).role || 'asesor';
  const { searchParams } = new URL(req.url);
  const requestedId = searchParams.get('user_id');

  // Solo supervisor/jefe/dev pueden ver leads de otro usuario
  let userId = sessionUserId;
  if (requestedId && ['supervisor', 'jefe_area', 'desarrollador', 'it'].includes(userRole)) {
    userId = parseInt(requestedId);
  }

  // Filtrar por proyecto (default Orange = 1)
  const proyectoId = parseInt(searchParams.get('proyecto_id') || '1');

  try {
    // Query única con JOIN para evitar N+1
    const { rows } = await pool.query(`
      SELECT pl.id as pipeline_id, c.id_cliente, c.numero_documento as dni,
             COALESCE(c.nombre_razon_social, cp.datos->'header'->>'nombre', 'Sin nombre') as nombre,
             COALESCE(cp.datos->'header'->>'paquete', 'N/A') as paquete,
             CASE WHEN (cp.datos->>'cima_global')::boolean THEN 'SI' ELSE 'NO' END as cima,
             cp.datos as raw_datos,
             cp.ultima_extraccion,
             COALESCE(pl.ronda_actual, 1) as ronda_actual
      FROM pipeline pl
      JOIN clientes c ON pl.id_cliente = c.id_cliente
      JOIN clientes_proyectos cp ON c.id_cliente = cp.id_cliente
        AND cp.proyecto_id = pl.proyecto_id
      WHERE pl.asesor_id = $1
        AND pl.proyecto_id = $2
        AND pl.estado = 'pendiente'
        AND pl.deleted_at IS NULL
      ORDER BY pl.ultimo_cambio ASC
      LIMIT 100
    `, [userId, proyectoId]);

    // Enriquecer con datos de líneas (ya tenemos raw_datos del JOIN)
    const leads = rows.map((r: any) => {
      const datos = r.raw_datos || {};
      const lineas = datos.lineas || [];
      const primera = lineas[0] || {};
      const principal = lineas.find((l: any) => l.es_principal) || primera;
      const tieneRenove = lineas.some((l: any) => l.tiene_renove);
      const PRIORIDAD = ['Renove mixto al mejor precio con maximo descuento', 'Renove mixto al mejor precio con descuento', 'Renove mixto al mejor precio', 'Renove mixto'];
      let variante = 'N/A';
      if (tieneRenove) {
        for (const p of PRIORIDAD) {
          const m = lineas.find((l: any) => l.variante_renove === p);
          if (m) { variante = p; break; }
        }
        if (variante === 'N/A') {
          const otra = lineas.find((l: any) => l.variante_renove && l.variante_renove !== 'N/A');
          if (otra) variante = otra.variante_renove;
        }
      }
      return {
        id_cliente: r.id_cliente,
        pipeline_id: r.pipeline_id,
        dni: r.dni,
        nombre: r.nombre,
        paquete: r.paquete,
        cima: r.cima,
        tiene_renove: tieneRenove ? 'SI' : 'NO',
        renove_variante: variante,
        lineas_count: lineas.length,
        intentos: r.ronda_actual || 1,
        lineas: lineas.map((l: any) => ({
          numero: l.numero, es_cima: l.es_cima || false,
          tiene_renove: l.tiene_renove || false, variante_renove: l.variante_renove || 'N/A',
          etiquetas: l.etiquetas || [], es_principal: l.es_principal || false,
          producto: l.producto || undefined,
          estado_detallado: l.estado_detallado || l.estado || undefined,
          permanencia: l.permanencia || undefined,
          consumo: l.consumo || undefined,
          venta_plazos: l.venta_plazos || l.vap || undefined,
          campanas_extra: l.campanas_extra || undefined,
        })),
      };
    });

    return NextResponse.json(leads);
  } catch (e: any) {
    console.error('[pipeline/mine]', e.message);
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
