/**
 * app/api/internal/bot-sync/route.ts — Endpoint Interno para Bots
 * ================================================================
 * El bot NO toca PostgreSQL directamente.
 * Solo hace POST con el JSON extraído y este endpoint maneja las transacciones.
 *
 * Seguridad: solo acepta requests con API_KEY_BOT en el header.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const BOT_API_KEY = process.env.BOT_API_KEY || 'oratioo-bot-internal-key';

export async function POST(req: Request) {
  // Validar API key
  const apiKey = req.headers.get('x-bot-api-key');
  if (apiKey !== BOT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id_cliente, proyecto_id, datos, estado } = body;

    if (!id_cliente || !datos) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
    }

    const pid = proyecto_id || 1; // Default: orange

    // 1. Actualizar clientes_proyectos
    await pool.query(
      `INSERT INTO clientes_proyectos (id_cliente, proyecto_id, datos, ultima_extraccion)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (id_cliente, proyecto_id) 
       DO UPDATE SET datos = $3, ultima_extraccion = now(), updated_at = now()`,
      [id_cliente, pid, JSON.stringify(datos)]
    );

    // 2. Registrar en historial
    await pool.query(
      `INSERT INTO historial (id_cliente, tipo, proyecto_id, descripcion, datos)
       VALUES ($1, 'extraccion', $2, $3, $4)`,
      [
        id_cliente,
        pid,
        `Bot extrajo ${datos.lineas?.length || 0} lineas`,
        JSON.stringify({
          estado: estado || 'completado',
          cima: datos.cima_global || false,
          lineas_count: datos.lineas?.length || 0,
        }),
      ]
    );

    return NextResponse.json({ success: true, id_cliente });
  } catch (error: any) {
    console.error('[bot-sync] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
