/**
 * app/api/clientes/route.ts — Clientes con datos del bot (Orange)
 * Soporta paginación server-side: ?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=50
 * 
 * Optimización: extrae solo campos necesarios del JSONB datos (no el blob completo).
 * Las líneas se reducen a 4 campos (numero, tiene_renove, variante_renove, es_cima)
 * porque son los únicos que usan los filtros del frontend.
 * La ficha expandida carga datos completos vía /api/clientes/[id].
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

const PRIORIDAD_RENOVE = [
  'Renove mixto al mejor precio con máximo descuento',
  'Renove mixto al mejor precio con descuento',
  'Renove mixto al mejor precio',
  'Renove mixto',
  'Renove Multidispositivo',
];

function transformarCliente(r: any) {
  const datos = r.datos || {};
  const header = datos.header || {};
  const lineas = datos.lineas || [];

  const nombre = datos.estado === 'no_cliente'
    ? (header.nombre || 'NO ES CLIENTE')
    : (header.nombre || r.nombre_razon_social || 'N/A');

  const cima = datos.cima_global ? 'SI' : 'NO';
  const primera = lineas[0] || {};
  const linea_principal = primera.numero || 'N/A';
  const paquete = header.paquete || 'N/A';

  const tiene_renove = lineas.some((l: any) => l.tiene_renove);
  let mejor_variante = 'N/A';
  if (tiene_renove) {
    for (const p of PRIORIDAD_RENOVE) {
      const match = lineas.find((l: any) => l.variante_renove === p);
      if (match) { mejor_variante = p; break; }
    }
    if (mejor_variante === 'N/A') {
      const otra = lineas.find((l: any) => l.variante_renove && l.variante_renove !== 'N/A');
      if (otra) mejor_variante = otra.variante_renove;
    }
  }

  // Extraer fecha y hora del timestamp
  const ts = r.ultima_extraccion ? new Date(r.ultima_extraccion) : null;
  const fecha = ts ? ts.toISOString().slice(0, 10) : '';
  const hora = ts ? ts.toTimeString().slice(0, 8) : '';

  return {
    id_cliente: r.id_cliente,
    dni: (r.numero_documento || r.id_cliente || '').replace(/^(DNI_|NIE_|NIF_)/, ''),
    tipo_documento: r.tipo_documento,
    nombre,
    tipo_persona: r.tipo_persona || 'natural',
    whatsapp_opt_in: r.whatsapp_opt_in || false,
    whatsapp_numero: r.whatsapp_numero || '',
    alertas_fidelizacion: r.alertas_fidelizacion || false,
    linea_principal,
    paquete,
    cima,
    tiene_renove: tiene_renove ? 'SI' : 'NO',
    renove_variante: mejor_variante,
    fecha,
    hora,
    estado: datos.estado || 'pendiente',
    lineas,
    header,
    cima_global: datos.cima_global || false,
  };
}

function buildConditions(params: any[], from: string, to: string) {
  const conditions: string[] = [];
  conditions.push(`cp.datos->>'estado' IN ('completado', 'no_cliente', 'sin_datos', 'no_cargable', 'error')`);
  if (from) { conditions.push(`cp.ultima_extraccion >= $${params.length + 1}::date`); params.push(from); }
  if (to) { conditions.push(`cp.ultima_extraccion < $${params.length + 1}::date + interval '1 day'`); params.push(to); }
  return conditions.join(' AND ');
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50000, Math.max(10, parseInt(searchParams.get('limit') || '50')));

    const params: any[] = [];
    const conditions = buildConditions(params, from, to);
    const where = `cp.proyecto_id = (SELECT id FROM proyectos WHERE nombre = 'orange') AND ${conditions}`;

    // Count total — sin JOIN a clientes (más rápido)
    const countResult = await pool.query(
      `SELECT count(*)::int as total
       FROM clientes_proyectos cp
       WHERE ${where}`,
      params
    );
    const total = countResult.rows[0].total;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    // Fetch page — extrae solo campos necesarios del JSONB
    const { rows } = await pool.query(
      `SELECT
         c.id_cliente, c.tipo_documento, c.numero_documento,
         c.nombre_razon_social, c.tipo_persona,
         c.whatsapp_opt_in, c.whatsapp_numero, c.alertas_fidelizacion,
         cp.ultima_extraccion, cp.updated_at,
         cp.datos->>'estado' as _estado,
         (cp.datos->>'cima_global')::boolean as _cima_global,
         cp.datos->'header'->>'nombre' as _header_nombre,
         cp.datos->'header'->>'paquete' as _header_paquete,
         COALESCE(
           (SELECT jsonb_agg(jsonb_build_object(
             'numero', l->>'numero',
             'tiene_renove', (l->>'tiene_renove')::boolean,
             'variante_renove', l->>'variante_renove',
             'es_cima', (l->>'es_cima')::boolean
           )) FROM jsonb_array_elements(cp.datos->'lineas') l),
           '[]'::jsonb
         ) as lineas
       FROM clientes_proyectos cp
       JOIN clientes c ON c.id_cliente = cp.id_cliente
       WHERE ${where}
       ORDER BY cp.ultima_extraccion DESC NULLS LAST
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    // Reconstruir el objeto 'datos' que espera transformarCliente
    const data = rows.map((r: any) => transformarCliente({
      ...r,
      datos: {
        estado: r._estado,
        cima_global: r._cima_global,
        header: {
          nombre: r._header_nombre || null,
          paquete: r._header_paquete || null,
        },
        lineas: r.lineas || [],
      },
    }));

    return NextResponse.json({ data, total, page, totalPages, limit });
  } catch (error: any) {
    console.error('[clientes] Error:', error.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
