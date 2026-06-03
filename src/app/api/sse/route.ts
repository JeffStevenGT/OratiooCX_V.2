/**
 * app/api/sse/route.ts — Server-Sent Events para notificaciones en tiempo real
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id');
  if (!userId) return NextResponse.json({ error: 'Falta user_id' }, { status: 400 });

  const encoder = new TextEncoder();
  let lastCheck = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      // Enviar estado inicial
      const { rows: [r] } = await pool.query(
        `SELECT COUNT(*) as total FROM pipeline WHERE asesor_id = $1 AND estado = 'pendiente' AND deleted_at IS NULL`,
        [parseInt(userId)]
      );
      send({ type: 'init', totalPendientes: parseInt(r.total) });

      // Polling cada 15 segundos
      const interval = setInterval(async () => {
        try {
          const { rows: [r2] } = await pool.query(
            `SELECT COUNT(*) as total FROM pipeline WHERE asesor_id = $1 AND estado = 'pendiente' AND deleted_at IS NULL AND ultimo_cambio > $2`,
            [parseInt(userId), new Date(lastCheck).toISOString()]
          );
          const nuevos = parseInt(r2.total);
          if (nuevos > 0) {
            send({ type: 'nuevos_leads', count: nuevos });
          }
          lastCheck = Date.now();
        } catch { /* */ }
      }, 15000);

      req.signal.addEventListener('abort', () => clearInterval(interval));
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
