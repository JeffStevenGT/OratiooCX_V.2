/**
 * app/api/proyectos/stats/route.ts — Stats por proyecto
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const { rows } = await pool.query(`
    SELECT cp.proyecto_id, COUNT(*) as total,
           COUNT(*) FILTER (WHERE cp.datos->>'estado' = 'pendiente') as pendientes,
           COUNT(*) FILTER (WHERE cp.datos->>'estado' = 'completado') as completados
    FROM clientes_proyectos cp
    GROUP BY cp.proyecto_id
    ORDER BY cp.proyecto_id
  `);
  return NextResponse.json(rows);
}
