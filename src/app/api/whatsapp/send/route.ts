/**
 * api/whatsapp/send/route.ts — Enviar mensaje WhatsApp
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sendText, sendTemplate } from '@/lib/whatsapp';

// GET — historial de mensajes de un cliente
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id_cliente = searchParams.get('id_cliente');
  if (!id_cliente) return NextResponse.json({ error: 'Falta id_cliente' }, { status: 400 });

  try {
    const { rows } = await pool.query(
      `SELECT id, direccion, tipo, mensaje, wa_status, created_at
       FROM whatsapp_mensajes WHERE id_cliente = $1
       ORDER BY created_at ASC LIMIT 100`,
      [id_cliente]
    );
    return NextResponse.json(rows);
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST — enviar mensaje
export async function POST(req: Request) {
  try {
    const { id_cliente, mensaje, template, params } = await req.json();
    if (!id_cliente) return NextResponse.json({ error: 'Falta id_cliente' }, { status: 400 });

    // Obtener número de WhatsApp del cliente
    const { rows: [c] } = await pool.query(
      `SELECT whatsapp_numero, whatsapp_opt_in FROM clientes WHERE id_cliente = $1`,
      [id_cliente]
    );

    if (!c?.whatsapp_numero) {
      return NextResponse.json({ error: 'Cliente sin número de WhatsApp' }, { status: 400 });
    }

    let result: any;
    let tipo = 'manual';

    if (template) {
      result = await sendTemplate(c.whatsapp_numero, template, params || []);
      tipo = template.includes('opt_in') ? 'opt_in_request' : 'alerta_renove';
    } else if (mensaje) {
      result = await sendText(c.whatsapp_numero, mensaje);
    } else {
      return NextResponse.json({ error: 'Falta mensaje o template' }, { status: 400 });
    }

    // Guardar en historial
    const waId = result?.messages?.[0]?.id;
    await pool.query(
      `INSERT INTO whatsapp_mensajes (id_cliente, direccion, tipo, mensaje, plantilla_meta, wa_message_id, wa_status, metadatos)
       VALUES ($1, 'saliente', $2, $3, $4, $5, $6, $7)`,
      [id_cliente, tipo, mensaje || template || '', template || null, waId || null, waId ? 'sent' : 'failed',
       JSON.stringify({ result })]
    );

    return NextResponse.json({ success: true, wa_message_id: waId });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
