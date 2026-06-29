/**
 * app/api/clientes/route.ts — Clientes con datos del bot (Orange)
 * Soporta paginación server-side: ?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=50
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

  // Extraer fecha y hora del timestamp (hora Madrid = servidor)
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

function buildWhere(params: any[], from: string, to: string) {
  const conditions: string[] = [];
  conditions.push(`cp.proyecto_id = p.pid`);
  conditions.push(`cp.datos->>'estado' IN ('completado', 'no_cliente', 'sin_datos', 'error')`);
  if (from) { conditions.push(`cp.ultima_extraccion AT TIME ZONE 'America/Lima' >= $${params.length + 1}::date`); params.push(from); }
  if (to) { conditions.push(`cp.ultima_extraccion AT TIME ZONE 'America/Lima' < $${params.length + 1}::date + interval '1 day'`); params.push(to); }
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
    const where = buildWhere(params, from, to);

    // Count total
    const countResult = await pool.query(
      `SELECT count(*)::int as total
       FROM clientes c
       CROSS JOIN (SELECT id AS pid FROM proyectos WHERE nombre = 'orange') p
       JOIN clientes_proyectos cp ON c.id_cliente = cp.id_cliente
       WHERE ${where}`,
      params
    );
    const total = countResult.rows[0].total;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    // Fetch page
    const { rows } = await pool.query(
      `WITH proyecto AS (SELECT id AS pid FROM proyectos WHERE nombre = 'orange')
       SELECT
         c.id_cliente, c.tipo_documento, c.numero_documento,
         c.nombre_razon_social, c.tipo_persona,
         c.whatsapp_opt_in, c.whatsapp_numero, c.alertas_fidelizacion,
         cp.datos, cp.ultima_extraccion, cp.updated_at
       FROM clientes c
       CROSS JOIN proyecto p
       JOIN clientes_proyectos cp ON c.id_cliente = cp.id_cliente
       WHERE ${where}
       ORDER BY cp.ultima_extraccion DESC NULLS LAST
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const data = rows.map(transformarCliente);

    return NextResponse.json({ data, total, page, totalPages, limit });
  } catch (error: any) {
    console.error('[clientes] Error:', error.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
