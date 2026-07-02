/**
 * POST /api/dashboard/refresh — Refresh materialized views manually
 */
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST() {
  try {
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pipeline_stats');
    return NextResponse.json({ ok: true, refreshed: 'mv_pipeline_stats' });
  } catch (e: any) {
    console.error('[api] refresh', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
