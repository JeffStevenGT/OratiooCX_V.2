/**
 * Webhook de VPBX — Ingesta Desacoplada con Redis
 * ==================================================
 * El endpoint responde en <50ms al VPBX (evitando timeouts).
 * El evento se encola en Redis y un worker/cron lo
 * consume para escribirlo en PostgreSQL con calma.
 *
 * Arquitectura:
 *   VPBX → POST /api/webhooks/vpbx → Redis (lpush) → Worker (cron/scheduled) → PostgreSQL
 */

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// En producción: redis desde Upstash o Redis local
// En desarrollo local: puede usarse BullMQ con Redis local o simplemente PostgreSQL directo
const redis = Redis.fromEnv();

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Validación mínima
    if (!payload.eventType || !payload.variables?.callId) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }

    // 🚀 Encolar inmediatamente y liberar al VPBX
    await redis.lpush(
      'vpbx:webhooks',
      JSON.stringify({
        eventType: payload.eventType,
        variables: payload.variables,
        receivedAt: Date.now(),
      })
    );

    // ⚡ Respuesta instantánea (<50ms) — el VPBX no espera
    return NextResponse.json({ status: 'queued' }, { status: 200 });
  } catch (error) {
    console.error('[VPBX Webhook Error]', error);
    return NextResponse.json({ error: 'Internal' }, { status: 500 });
  }
}

/**
 * Worker que procesa la cola de webhooks (se ejecuta como cron job o scheduled task).
 * Lee los eventos encolados y los persiste en PostgreSQL.
 */
export async function processVpbxWebhookQueue(db: any) {
  while (true) {
    const raw = await redis.rpop('vpbx:webhooks');
    if (!raw) break;

    const event = JSON.parse(raw);
    const { callId, callerNumber, calleeNumber } = event.variables;

    switch (event.eventType) {
      case 'ANSWERED': {
        // Vincular llamada con cliente por número de teléfono
        const cliente = await db.query(
          `SELECT id_cliente FROM clientes WHERE telefonos @> $1 LIMIT 1`,
          [JSON.stringify([calleeNumber])]
        );

        if (cliente?.rows?.[0]) {
          await db.query(
            `INSERT INTO cdr_vpbx (call_id, id_cliente, raw_data, created, src, dst)
             VALUES ($1, $2, $3, now(), $4, $5)
             ON CONFLICT (call_id) DO UPDATE SET raw_data = $3`,
            [callId, cliente.rows[0].id_cliente, JSON.stringify(event), callerNumber, calleeNumber]
          );

          await db.query(
            `INSERT INTO historial (id_cliente, tipo, proyecto_id, descripcion, datos)
             VALUES ($1, 'llamada', (SELECT id FROM proyectos WHERE nombre = 'orange' LIMIT 1),
                     'Llamada contestada', $2)`,
            [cliente.rows[0].id_cliente, JSON.stringify({ callId, callerNumber, calleeNumber })]
          );
        }
        break;
      }

      case 'HANGUP': {
        // Actualizar duración de la llamada
        await db.query(
          `UPDATE cdr_vpbx SET raw_data = $1, sincronizado = now()
           WHERE call_id = $2`,
          [JSON.stringify(event), callId]
        );
        break;
      }

      case 'RINGING': {
        // Registrar intento de llamada (aún no contestada)
        await db.query(
          `INSERT INTO cdr_vpbx (call_id, created, src, dst, raw_data)
           VALUES ($1, now(), $2, $3, $4)
           ON CONFLICT (call_id) DO NOTHING`,
          [callId, callerNumber, calleeNumber, JSON.stringify(event)]
        );
        break;
      }
    }
  }
}
