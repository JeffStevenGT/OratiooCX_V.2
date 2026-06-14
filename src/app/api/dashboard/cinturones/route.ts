/**
 * GET /api/dashboard/cinturones — Cinturones actuales + historial
 * POST /api/dashboard/cinturones — Otorgar cinturones del mes
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mes = searchParams.get('mes') || new Date().toISOString().slice(0, 7);
  const asesorId = searchParams.get('asesor_id');

  try {
    let asesores: any[];
    if (asesorId) {
      const { rows } = await pool.query(
        'SELECT id, nombre, equipo FROM usuarios WHERE id = $1 AND activo = true',
        [parseInt(asesorId)]
      );
      asesores = rows;
    } else {
      const { rows } = await pool.query(
        "SELECT id, nombre, equipo FROM usuarios WHERE rol = 'asesor' AND activo = true ORDER BY nombre"
      );
      asesores = rows;
    }

    const resultado = [];
    for (const a of asesores) {
      const { rows: [c] } = await pool.query(
        'SELECT * FROM cinturon_actual($1, $2)',
        [a.id, mes]
      );
      // Historial de logros
      const { rows: logros } = await pool.query(
        `SELECT lc.mes, c.nombre, c.color_hex, c.icono, lc.ventas_mes, lc.obtenido_at
         FROM logros_cinturon lc
         JOIN cinturones c ON lc.cinturon_id = c.id
         WHERE lc.asesor_id = $1
         ORDER BY lc.mes DESC`,
        [a.id]
      );
      resultado.push({
        asesor_id: a.id,
        nombre: a.nombre,
        equipo: a.equipo,
        actual: c || null,
        historial: logros,
      });
    }

    return NextResponse.json({ mes, cinturones: resultado });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const mes = body.mes || new Date().toISOString().slice(0, 7);
  const proyectoId = body.proyecto_id || 1;

  try {
    // Obtener métricas del mes para cada asesor
    const { rows: asesores } = await pool.query(
      "SELECT id, nombre FROM usuarios WHERE rol = 'asesor' AND activo = true"
    );

    const otorgados: any[] = [];
    for (const a of asesores) {
      const { rows: [c] } = await pool.query(
        'SELECT * FROM cinturon_actual($1, $2)',
        [a.id, mes]
      );
      if (!c || !c.cinturon_nombre || c.cinturon_nombre === 'Blanco') continue;

      // Ver si ya tiene este cinturón este mes
      const { rows: [existe] } = await pool.query(
        `SELECT id FROM logros_cinturon
         WHERE asesor_id = $1 AND mes = $2 AND ventas_mes >= $3
         ORDER BY ventas_mes DESC LIMIT 1`,
        [a.id, mes, c.ventas_mes]
      );

      if (existe) continue; // Ya otorgado

      // Otorgar
      const { rows: [cinturonDb] } = await pool.query(
        'SELECT id FROM cinturones WHERE nombre = $1',
        [c.cinturon_nombre]
      );

      if (cinturonDb) {
        await pool.query(
          `INSERT INTO logros_cinturon (asesor_id, cinturon_id, mes, ventas_mes, contactabilidad, efectividad, calidad_promedio)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [a.id, cinturonDb.id, mes, c.ventas_mes, parseFloat(c.contactabilidad || '0'), parseFloat(c.efectividad || '0'), parseFloat(c.calidad || '0')]
        );

        // Notificar al supervisor
        const { rows: [sup] } = await pool.query(
          'SELECT supervisor_id FROM usuarios WHERE id = $1',
          [a.id]
        );
        if (sup?.supervisor_id) {
          await pool.query(
            `INSERT INTO notificaciones_supervisor (supervisor_id, asesor_id, tipo, titulo, mensaje, datos)
             VALUES ($1, $2, 'cinturon_obtenido', $3, $4, $5)`,
            [sup.supervisor_id, a.id,
             `🏅 ${a.nombre} alcanzó cinturón ${c.cinturon_nombre}`,
             `${a.nombre} obtuvo el cinturón ${c.cinturon_icono} ${c.cinturon_nombre} con ${c.ventas_mes} ventas este mes.`,
             JSON.stringify({ cinturon: c.cinturon_nombre, ventas: c.ventas_mes, icono: c.cinturon_icono })]
          );
        }

        otorgados.push({ asesor: a.nombre, cinturon: c.cinturon_nombre, icono: c.cinturon_icono, ventas: c.ventas_mes });
      }
    }

    return NextResponse.json({ mes, otorgados, total: otorgados.length });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
