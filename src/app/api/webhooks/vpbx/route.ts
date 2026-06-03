/**
 * app/api/webhooks/vpbx/route.ts — Webhook VPBX (RINGING, ANSWERED, HANGUP)
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  try {
    const event = await req.json();
    const { eventType, variables } = event;
    const { callId, callerNumber, calleeNumber } = variables || {};

    if (!eventType || !callId) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }

    switch (eventType) {
      case 'RINGING':
        await pool.query(
          `INSERT INTO cdr_vpbx (call_id, created, src, dst, raw_data)
           VALUES ($1, now(), $2, $3, $4)
           ON CONFLICT (call_id) DO NOTHING`,
          [callId, callerNumber, calleeNumber, JSON.stringify(event)]
        );
        break;

      case 'ANSWERED':
        // Vincular con cliente por número
        const { rows: clientes } = await pool.query(
          `SELECT id_cliente FROM clientes WHERE telefonos @> $1::jsonb LIMIT 1`,
          [JSON.stringify([calleeNumber])]
        );
        if (clientes.length > 0) {
          await pool.query(
            `UPDATE cdr_vpbx SET id_cliente = $1 WHERE call_id = $2`,
            [clientes[0].id_cliente, callId]
          );
          await pool.query(
            `INSERT INTO historial (id_cliente, tipo, proyecto_id, descripcion, datos)
             VALUES ($1, 'llamada', 1, 'Llamada contestada', $2)`,
            [clientes[0].id_cliente, JSON.stringify({ callId, callerNumber, calleeNumber })]
          );
        }
        break;

      case 'HANGUP':
        await pool.query(
          `UPDATE cdr_vpbx SET raw_data = $1, sincronizado = now() WHERE call_id = $2`,
          [JSON.stringify(event), callId]
        );
        break;
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }
}
