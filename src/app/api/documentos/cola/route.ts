/**
 * app/api/documentos/cola/route.ts — Estado de la cola de DNIs
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // Stats por estado
    const { rows: stats } = await pool.query(`
      SELECT
        COALESCE(datos->>'estado', 'pendiente') as estado,
        COUNT(*) as total
      FROM clientes_proyectos cp
      WHERE cp.proyecto_id = (SELECT id FROM proyectos WHERE nombre = 'orange')
      GROUP BY datos->>'estado'
    `);

    // Últimos 50 DNIs con su estado
    const { rows: dnis } = await pool.query(`
      SELECT cp.id_cliente, cp.datos->>'estado' as estado,
             cp.ultima_extraccion, cp.updated_at
      FROM clientes_proyectos cp
      WHERE cp.proyecto_id = (SELECT id FROM proyectos WHERE nombre = 'orange')
      ORDER BY cp.updated_at DESC NULLS LAST
      LIMIT 50
    `);

    const resumen: Record<string, number> = {};
    for (const s of stats) {
      resumen[s.estado || 'pendiente'] = Number(s.total);
    }

    return NextResponse.json({ resumen, dnis });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
