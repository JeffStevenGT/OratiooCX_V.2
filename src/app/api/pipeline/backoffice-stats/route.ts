/**
 * app/api/pipeline/backoffice-stats/route.ts
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const { rows: [r1] } = await pool.query(
    `SELECT COUNT(*) as total FROM pipeline WHERE estado = 'venta' AND deleted_at IS NULL`
  );
  const { rows: [r2] } = await pool.query(
    `SELECT COUNT(*) as total FROM pipeline WHERE estado = 'tramitado' AND ultimo_cambio::date = current_date AND deleted_at IS NULL`
  );
  return NextResponse.json({ pendientes: parseInt(r1.total), tramitadasHoy: parseInt(r2.total) });
}
