/**
 * app/api/documentos/cola/route.ts — Estado de la cola (monitoreo BD VPS)
 * Soporta ?from=YYYY-MM-DD&to=YYYY-MM-DD para filtrar por ultima_extraccion
 * Soporta ?tipo=tel|doc para filtrar por tipo de id_cliente
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const tipo = searchParams.get('tipo') || 'todos'; // 'tel' | 'doc' | 'todos'

    // Filtro por tipo de id_cliente
    const tipoCondition = tipo === 'tel'
      ? `AND cp.id_cliente LIKE 'TEL_%'`
      : tipo === 'doc'
        ? `AND cp.id_cliente NOT LIKE 'TEL_%'`
        : '';

    // Condición de fecha para ultima_extraccion
    const dateCondition = (from || to)
      ? `AND cp.ultima_extraccion >= ${from ? `'${from}'::date` : `'2000-01-01'::date`}
         AND cp.ultima_extraccion < ${to ? `'${to}'::date + interval '1 day'` : `now() + interval '1 day'`}`
      : '';

    const baseWhere = `cp.proyecto_id = (SELECT id FROM proyectos WHERE nombre = 'orange') ${tipoCondition}`;

    // Stats por estado (histórico completo)
    const { rows: stats } = await pool.query(`
      SELECT
        CASE 
          WHEN cp.datos->>'estado' IS NULL THEN 'null'
          ELSE cp.datos->>'estado'
        END as estado,
        COUNT(*)::int as total
      FROM clientes_proyectos cp
      WHERE ${baseWhere}
      GROUP BY 1 ORDER BY 2 DESC
    `);

    // Stats del día (filtrado por fecha si se especifica)
    const { rows: statsDia } = await pool.query(`
      SELECT
        CASE 
          WHEN cp.datos->>'estado' IS NULL THEN 'null'
          ELSE cp.datos->>'estado'
        END as estado,
        COUNT(*)::int as total
      FROM clientes_proyectos cp
      WHERE ${baseWhere} ${dateCondition}
      GROUP BY 1 ORDER BY 2 DESC
    `);

    // Total general
    const { rows: [totalRow] } = await pool.query(`
      SELECT COUNT(*)::int as total FROM clientes_proyectos cp WHERE ${baseWhere}
    `);

    // Procesados hoy
    const { rows: [hoyRow] } = await pool.query(`
      SELECT COUNT(*)::int as total FROM clientes_proyectos cp
      WHERE ${baseWhere} AND cp.ultima_extraccion >= CURRENT_DATE
    `);

    // Listos para reprocesar (null + sin ultima_extraccion)
    const { rows: [listosRow] } = await pool.query(`
      SELECT COUNT(*)::int as total FROM clientes_proyectos cp
      WHERE ${baseWhere} AND cp.datos->>'estado' IS NULL AND cp.ultima_extraccion IS NULL
    `);

    // Últimos 50 DNIs con su estado
    const { rows: dnis } = await pool.query(`
      SELECT cp.id_cliente, 
             CASE WHEN cp.datos->>'estado' IS NULL THEN 'null' ELSE cp.datos->>'estado' END as estado,
             cp.ultima_extraccion, cp.updated_at
      FROM clientes_proyectos cp
      WHERE ${baseWhere}
      ORDER BY cp.updated_at DESC NULLS LAST
      LIMIT 50
    `);

    const resumen: Record<string, number> = {};
    for (const s of stats) {
      resumen[s.estado] = Number(s.total);
    }

    const resumenDia: Record<string, number> = {};
    for (const s of statsDia) {
      resumenDia[s.estado] = Number(s.total);
    }

    return NextResponse.json({
      resumen,
      resumenDia,
      total: totalRow.total,
      procesadosHoy: hoyRow.total,
      listosReprocesar: listosRow.total,
      dnis,
      tipo,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
