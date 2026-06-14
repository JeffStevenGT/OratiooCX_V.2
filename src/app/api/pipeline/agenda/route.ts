/**
 * app/api/pipeline/agenda/route.ts — Callbacks agrupados
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const userRol = searchParams.get('rol');

    const hoy = new Date().toISOString().split('T')[0];
    const mananaDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const semanaFin = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const { rows } = await pool.query(`
      SELECT pl.id, pl.id_cliente, c.numero_documento as dni,
             COALESCE(c.nombre_razon_social, 'Sin nombre') as nombre,
             pl.callback_at, pl.estado, u.nombre as asesor,
             cp.datos->'lineas'->0->>'numero' as linea,
             CASE WHEN (cp.datos->>'cima_global')::boolean THEN 'SI' ELSE 'NO' END as cima,
             (SELECT COUNT(*) FROM historial h WHERE h.id_cliente = pl.id_cliente AND h.tipo = 'llamada')::int as intentos
      FROM pipeline pl
      JOIN clientes c ON pl.id_cliente = c.id_cliente
      JOIN usuarios u ON pl.asesor_id = u.id
      LEFT JOIN clientes_proyectos cp ON c.id_cliente = cp.id_cliente
        AND cp.proyecto_id = pl.proyecto_id
      WHERE pl.callback_at IS NOT NULL
        AND pl.deleted_at IS NULL
        AND pl.estado = 'no_contesta'
        ${userId && userRol === 'asesor' ? `AND pl.asesor_id = ${parseInt(userId)}` : ''}
      ORDER BY pl.callback_at ASC
      LIMIT 200
    `);

    const ahora = new Date();
    const vencidos: any[] = [], hoyList: any[] = [], mananaList: any[] = [], semanaList: any[] = [];

    for (const r of rows) {
      const d = new Date(r.callback_at);
      if (d < new Date(hoy)) vencidos.push(r);
      else if (d.toISOString().split('T')[0] === hoy) hoyList.push(r);
      else if (d.toISOString().split('T')[0] === mananaDate) mananaList.push(r);
      else semanaList.push(r);
    }

    return NextResponse.json({ vencidos, hoy: hoyList, manana: mananaList, semana: semanaList });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
