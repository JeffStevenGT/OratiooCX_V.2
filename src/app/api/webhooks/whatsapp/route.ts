/**
 * api/webhooks/whatsapp/route.ts — Webhook Meta WhatsApp
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyWebhook, parseIncoming } from '@/lib/whatsapp';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode') || '';
  const token = searchParams.get('hub.verify_token') || '';
  const challenge = searchParams.get('hub.challenge') || '';

  const result = verifyWebhook(mode, token, challenge);
  if (result) return new Response(result, { status: 200 });
  return new Response('Forbidden', { status: 403 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = parseIncoming(body);

    for (const msg of messages) {
      // Buscar cliente por número de WhatsApp
      const { rows: [cliente] } = await pool.query(
        `SELECT id_cliente FROM clientes WHERE whatsapp_numero = $1`,
        [msg.from]
      );

      if (cliente) {
        await pool.query(
          `INSERT INTO whatsapp_mensajes (id_cliente, direccion, tipo, mensaje, wa_message_id, metadatos)
           VALUES ($1, 'entrante', 'respuesta_cliente', $2, $3, $4)`,
          [cliente.id_cliente, msg.text || '(sin texto)', msg.id, JSON.stringify({ from: msg.from, type: msg.type })]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[whatsapp webhook]', e.message);
    // Siempre 200 para que Meta no reintente
    return NextResponse.json({ success: true, warning: 'error interno' }, { status: 200 });
  }
}
