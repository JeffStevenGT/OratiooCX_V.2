/**
 * app/api/pipeline/mine/route.ts — Mis leads (asesor)
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');
  if (!userId) return NextResponse.json({ error: 'Falta user_id' }, { status: 400 });

  try {
    const { rows } = await pool.query(`
      SELECT pl.id as pipeline_id, c.id_cliente, c.numero_documento as dni,
             COALESCE(c.nombre_razon_social, cp.datos->'header'->>'nombre', 'Sin nombre') as nombre,
             COALESCE(cp.datos->'header'->>'paquete', 'N/A') as paquete,
             CASE WHEN (cp.datos->>'cima_global')::boolean THEN 'SI' ELSE 'NO' END as cima,
             cp.ultima_extraccion,
             (SELECT COUNT(*) FROM historial h WHERE h.id_cliente = c.id_cliente AND h.tipo = 'llamada' AND h.created_at::date = current_date)::int as intentos
      FROM pipeline pl
      JOIN clientes c ON pl.id_cliente = c.id_cliente
      JOIN clientes_proyectos cp ON c.id_cliente = cp.id_cliente
        AND cp.proyecto_id = pl.proyecto_id
      WHERE pl.asesor_id = $1
        AND pl.estado = 'pendiente'
        AND pl.deleted_at IS NULL
      ORDER BY pl.ultimo_cambio ASC
      LIMIT 100
    `, [parseInt(userId)]);

    // Enriquecer con datos de líneas
    const leads = await Promise.all(rows.map(async (r: any) => {
      // Obtener datos del bot para línea principal y renove
      const { rows: [cp] } = await pool.query(
        `SELECT datos FROM clientes_proyectos WHERE id_cliente = $1 AND proyecto_id = 1`,
        [r.id_cliente]
      );
      const datos = cp?.datos || {};
      const lineas = datos.lineas || [];
      const primera = lineas[0] || {};
      const principal = lineas.find((l: any) => l.es_principal) || primera;
      const tieneRenove = lineas.some((l: any) => l.tiene_renove);
      const PRIORIDAD = ['Renove mixto al mejor precio con máximo descuento', 'Renove mixto al mejor precio con descuento', 'Renove mixto al mejor precio', 'Renove mixto'];
      let variante = 'N/A';
      if (tieneRenove) {
        for (const p of PRIORIDAD) {
          const m = lineas.find((l: any) => l.variante_renove === p);
          if (m) { variante = p; break; }
        }
      }
      return {
        ...r,
        linea_principal: principal.numero || 'N/A',
        tiene_renove: tieneRenove ? 'SI' : 'NO',
        renove_variante: variante,
        lineas_count: lineas.length,
        intentos: r.intentos || 0,
        lineas: lineas.map((l: any) => ({
          numero: l.numero, es_cima: l.es_cima || false,
          tiene_renove: l.tiene_renove || false, variante_renove: l.variante_renove || 'N/A',
          etiquetas: l.etiquetas || [], es_principal: l.es_principal || false,
        })),
      };
    }));

    return NextResponse.json(leads);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
