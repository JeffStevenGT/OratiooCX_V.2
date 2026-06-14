/**
 * api/qa/route.ts — CRUD evaluaciones QA
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole, requireAuth } from '@/lib/auth-roles';

// GET — listar evaluaciones
export async function GET(req: Request) {
  try {
    await requireRole('auditor_calidad', 'supervisor', 'jefe_area', 'desarrollador');
    const { searchParams } = new URL(req.url);
    const asesorId = searchParams.get('asesor_id');
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');

    const where: string[] = [];
    const params: any[] = [];
    let pi = 1;
    if (asesorId) { where.push(`qe.asesor_id = $${pi++}`); params.push(parseInt(asesorId)); }
    if (desde) { where.push(`qe.created_at::date >= $${pi++}`); params.push(desde); }
    if (hasta) { where.push(`qe.created_at::date <= $${pi++}`); params.push(hasta); }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT qe.*, u.nombre as asesor_nombre, au.nombre as auditor_nombre,
             c.numero_documento as dni
      FROM qa_evaluaciones qe
      JOIN usuarios u ON qe.asesor_id = u.id
      JOIN usuarios au ON qe.auditor_id = au.id
      LEFT JOIN clientes c ON qe.id_cliente = c.id_cliente
      ${whereClause}
      ORDER BY qe.created_at DESC LIMIT 100
    `, params);

    return NextResponse.json(rows);
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST — crear evaluación
export async function POST(req: Request) {
  try {
    await requireRole('auditor_calidad', 'supervisor', 'jefe_area', 'desarrollador');

    const session = await requireAuth();
    const auditorId = (session.user as any).id;

    const { pipeline_id, id_cliente, asesor_id, call_id,
      puntaje_speech, puntaje_objeciones, puntaje_cierre, puntaje_compliance, puntaje_empatia, notas } = await req.json();

    if (!id_cliente || !asesor_id) {
      return NextResponse.json({ error: 'Faltan id_cliente y asesor_id' }, { status: 400 });
    }

    const { rows: [e] } = await pool.query(`
      INSERT INTO qa_evaluaciones
        (pipeline_id, id_cliente, asesor_id, auditor_id, call_id,
         puntaje_speech, puntaje_objeciones, puntaje_cierre, puntaje_compliance, puntaje_empatia, notas)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [pipeline_id || null, id_cliente, asesor_id, auditorId, call_id || null,
        puntaje_speech, puntaje_objeciones, puntaje_cierre, puntaje_compliance, puntaje_empatia, notas]);

    // Registrar en historial
    await pool.query(`
      INSERT INTO historial (id_cliente, tipo, proyecto_id, asesor_id, descripcion, datos)
      VALUES ($1, 'qa_review', 1, $2, $3, $4)
    `, [id_cliente, asesor_id, `QA: ${e.puntaje_total}/25 — ${notas || 'Sin notas'}`, JSON.stringify(e)]);

    return NextResponse.json(e, { status: 201 });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// GET stats — resumen QA por asesor
export async function PATCH(req: Request) {
  // Reutilizamos PATCH para stats
  try {
    await requireRole('auditor_calidad', 'supervisor', 'jefe_area', 'desarrollador');
    const { rows } = await pool.query(`
      SELECT u.nombre, u.equipo,
        COUNT(*)::int as total_evaluaciones,
        COALESCE(AVG(qe.puntaje_total)::numeric(4,1), 0) as promedio,
        COALESCE(AVG(qe.puntaje_speech)::numeric(3,1), 0) as avg_speech,
        COALESCE(AVG(qe.puntaje_cierre)::numeric(3,1), 0) as avg_cierre,
        COALESCE(AVG(qe.puntaje_empatia)::numeric(3,1), 0) as avg_empatia,
        MAX(qe.created_at) as ultima_evaluacion
      FROM usuarios u
      LEFT JOIN qa_evaluaciones qe ON u.id = qe.asesor_id
      WHERE u.rol = 'asesor'
      GROUP BY u.id, u.nombre, u.equipo
      ORDER BY promedio DESC NULLS LAST
    `);
    return NextResponse.json(rows);
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
