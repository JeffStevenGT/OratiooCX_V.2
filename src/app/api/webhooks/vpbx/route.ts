/**
 * app/api/webhooks/vpbx/route.ts — Webhook VPBX (RINGING, ANSWERED, HANGUP)
 * 
 * Con Redis: encola eventos para procesamiento asíncrono (evita saturación en ráfagas).
 * Sin Redis: procesa síncrono (comportamiento anterior, compatible).
 */

import { NextResponse } from 'next/server';
import { enqueueWebhook } from '@/lib/redis';
import pool from '@/lib/db';

/**
 * Procesa un evento de webhook VPBX de forma síncrona (fallback sin Redis).
 */
async function processWebhookEvent(eventType: string, variables: any) {
  const { callId, callerNumber, calleeNumber } = variables || {};

  switch (eventType) {
    case 'RINGING':
      await pool.query(
        `INSERT INTO cdr_vpbx (call_id, created, src, dst, raw_data)
         VALUES ($1, now(), $2, $3, $4)
         ON CONFLICT (call_id) DO NOTHING`,
        [callId, callerNumber, calleeNumber, JSON.stringify({ eventType, variables })]
      );
      break;

    case 'ANSWERED':
      const { rows: clientes } = await pool.query(
        `SELECT id_cliente FROM clientes 
         WHERE telefonos @> $1::jsonb
            OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(telefonos_v2, '[]'::jsonb)) AS t WHERE t->>'num' = $2)
         LIMIT 1`,
        [JSON.stringify([callerNumber]), callerNumber]
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
        [JSON.stringify({ eventType, variables }), callId]
      );
      break;
  }
}

export async function POST(req: Request) {
  try {
    const event = await req.json();
    const { eventType, variables } = event;
    const { callId } = variables || {};

    if (!eventType || !callId) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }

    // Intentar encolar vía Redis (si está disponible)
    // Los eventos en cola se procesan asíncronamente para no bloquear la respuesta
    try {
      await enqueueWebhook(event);
      // Si Redis está disponible, también procesamos síncrono para inmediatez
      // (la cola sirve como buffer de seguridad para ráfagas)
      await processWebhookEvent(eventType, variables);
    } catch {
      // Si Redis falla, procesar síncrono como fallback
      await processWebhookEvent(eventType, variables);
    }

    // Siempre retornar 200 para que VPBX no reintente
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error: any) {
    console.error('[webhooks/vpbx] Error:', error.message);
    return NextResponse.json({ status: 'ok', warning: 'error interno' }, { status: 200 });
  }
}
