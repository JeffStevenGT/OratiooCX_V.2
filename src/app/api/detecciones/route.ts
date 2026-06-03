/**
 * app/api/detecciones/route.ts — Últimas detecciones
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM detecciones
       WHERE created_at > now() - interval '2 days'
       ORDER BY created_at DESC
       LIMIT 100`
    );
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
