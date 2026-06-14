/**
 * GET /api/dashboard/reutilizacion — Tasa de reutilización de registros
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const proyectoId = parseInt(searchParams.get('proyecto_id') || '1');
  const dias = parseInt(searchParams.get('dias') || '90');

  try {
    const { rows: [result] } = await pool.query(
      'SELECT * FROM tasa_reutilizacion($1, $2)',
      [proyectoId, dias]
    );

    return NextResponse.json(result || {
      total_registros: 0,
      reanalizados: 0,
      tasa: 0,
      promedio_dias_entre_extracciones: 0,
    });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
