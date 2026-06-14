/**
 * GET /api/dashboard/salud-base — Ratio de calidad de la base de datos
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const proyecto = searchParams.get('proyecto_id') || '1';

  try {
    const { rows: [result] } = await pool.query(
      'SELECT salud_base($1) as datos',
      [proyecto]
    );
    return NextResponse.json(result?.datos || { total: 0, limpios: 0, porcentaje: 100, detalle: {} });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
