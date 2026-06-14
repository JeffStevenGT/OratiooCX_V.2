/**
 * API /api/pausas — Gestión de pausas de asesores
 * ===============================================
 * POST   - Iniciar una pausa (baño, almuerzo, descanso, reunión, etc.)
 * PUT    - Finalizar la pausa activa
 * GET    - Historial de pausas (con filtros opcionales)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-roles';
import pool from '@/lib/db';

const TIPOS = ['bano', 'almuerzo', 'descanso', 'reunion', 'capacitacion', 'otro'] as const;

// POST — Iniciar pausa
export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const userId = parseInt((session.user as any).id);
    const { tipo, notas } = await req.json();

    if (!tipo || !TIPOS.includes(tipo)) {
      return NextResponse.json(
        { error: `Tipo inválido. Usar: ${TIPOS.join(', ')}` },
        { status: 400 }
      );
    }

    // Verificar que no tenga una pausa activa
    const { rows: activa } = await pool.query(
      `SELECT id, tipo, inicio FROM pausas WHERE usuario_id = $1 AND fin IS NULL LIMIT 1`,
      [userId]
    );
    if (activa.length > 0) {
      return NextResponse.json(
        { error: `Ya tienes una pausa activa: ${activa[0].tipo} desde ${activa[0].inicio}` },
        { status: 409 }
      );
    }

    const { rows: [pausa] } = await pool.query(
      `INSERT INTO pausas (usuario_id, tipo, notas) VALUES ($1, $2, $3)
       RETURNING id, tipo, inicio, notas`,
      [userId, tipo, notas || null]
    );

    return NextResponse.json(pausa, { status: 201 });
  } catch (e: any) {
    if (e.message === 'No autenticado') return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    console.error('[api/pausas]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT — Finalizar pausa activa
export async function PUT(req: Request) {
  try {
    const session = await requireAuth();
    const userId = parseInt((session.user as any).id);

    const { rows: activa } = await pool.query(
      `SELECT id, tipo, inicio FROM pausas WHERE usuario_id = $1 AND fin IS NULL LIMIT 1`,
      [userId]
    );
    if (activa.length === 0) {
      return NextResponse.json({ error: 'No tienes pausas activas' }, { status: 404 });
    }

    const now = new Date();
    const inicio = new Date(activa[0].inicio);
    const duracion = Math.round((now.getTime() - inicio.getTime()) / 1000);

    await pool.query(
      `UPDATE pausas SET fin = $1, duracion_segundos = $2 WHERE id = $3`,
      [now.toISOString(), duracion, activa[0].id]
    );

    return NextResponse.json({
      id: activa[0].id,
      tipo: activa[0].tipo,
      inicio: activa[0].inicio,
      fin: now.toISOString(),
      duracion_segundos: duracion,
    });
  } catch (e: any) {
    if (e.message === 'No autenticado') return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    console.error('[api/pausas]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// GET — Listar pausas
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const authUserId = parseInt((session.user as any).id);
    const authRole = (session.user as any).role;
    const { searchParams } = new URL(req.url);

    const usuarioId = searchParams.get('usuario_id');
    const targetId = usuarioId ? parseInt(usuarioId) : authUserId;
    
    // Solo ver pausas propias, excepto supervisor/jefe/dev
    if (targetId !== authUserId && !['supervisor', 'jefe_area', 'desarrollador', 'it'].includes(authRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Activa (la pausa sin finalizar)
    const activaOnly = searchParams.get('activa') === '1';
    if (activaOnly) {
      const { rows } = await pool.query(
        `SELECT id, tipo, inicio, notas FROM pausas WHERE usuario_id = $1 AND fin IS NULL LIMIT 1`,
        [targetId]
      );
      // Calcular duración en vivo
      const pausa = rows[0] || null;
      if (pausa) {
        const inicio = new Date(pausa.inicio).getTime();
        pausa.duracion_segundos = Math.round((Date.now() - inicio) / 1000);
      }
      return NextResponse.json(pausa);
    }

    // Hoy (todas las pausas del día)
    const hoy = searchParams.get('hoy') === '1';
    let query = `SELECT id, usuario_id, tipo, inicio, fin, duracion_segundos, notas 
                 FROM pausas WHERE usuario_id = $1`;
    const params: any[] = [targetId];

    if (hoy) {
      query += ` AND inicio::date = CURRENT_DATE`;
    }

    query += ` ORDER BY inicio DESC LIMIT 50`;
    const { rows } = await pool.query(query, params);

    // Si se pide con nombres de usuario (para supervisor)
    if (searchParams.get('equipo') === '1' && ['supervisor', 'jefe_area', 'desarrollador'].includes(authRole)) {
      const { rows: equipoRows } = await pool.query(
        `SELECT p.id, p.usuario_id, p.tipo, p.inicio, p.fin, p.duracion_segundos, p.notas, u.nombre, u.equipo
         FROM pausas p JOIN usuarios u ON p.usuario_id = u.id
         WHERE p.inicio::date = CURRENT_DATE AND u.activo = true
         ORDER BY p.inicio DESC`
      );
      return NextResponse.json(equipoRows);
    }

    return NextResponse.json(rows);
  } catch (e: any) {
    if (e.message === 'No autenticado') return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    console.error('[api/pausas]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
