/**
 * app/api/maquinas/route.ts — CRUD de Máquinas
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// ── GET ──
export async function GET() {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM maquinas ORDER BY nombre'
    );
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── POST (crear) ──
export async function POST(req: Request) {
  try {
    const { nombre, ip, workers_max, notas } = await req.json();
    if (!nombre) return NextResponse.json({ error: 'Falta nombre' }, { status: 400 });

    const { rows: [m] } = await pool.query(
      `INSERT INTO maquinas (nombre, ip, workers_max, notas)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (nombre) DO UPDATE
         SET ip = $2, workers_max = $3, notas = $4, updated_at = now()
       RETURNING *`,
      [nombre.trim(), ip || null, workers_max || 5, notas || null]
    );

    return NextResponse.json(m, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── DELETE ──
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

    await pool.query('DELETE FROM maquinas WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── PATCH (heartbeat) ──
export async function PATCH(req: Request) {
  try {
    const { nombre, workers_activos } = await req.json();
    if (!nombre) return NextResponse.json({ error: 'Falta nombre' }, { status: 400 });

    await pool.query(
      `UPDATE maquinas
       SET workers_activos = $2,
           ultimo_heartbeat = now(),
           estado = 'online',
           updated_at = now()
       WHERE nombre = $1`,
      [nombre, workers_activos || 0]
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
