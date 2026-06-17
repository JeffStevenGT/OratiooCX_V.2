/**
 * app/api/sse/route.ts — Server-Sent Events para notificaciones en tiempo real
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Solo usuarios autenticados pueden suscribirse a SSE
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const authUserId = (session.user as any).id;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id') || authUserId;
  // Solo ver datos propios (o cualquiera si es jefe/dev)
  const role = (session.user as any).role;
  if (String(userId) !== String(authUserId) && !['jefe_area', 'supervisor', 'desarrollador'].includes(role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const encoder = new TextEncoder();
  let lastCheck = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { /* cliente desconectado */ }
      };

      let closed = false;
      req.signal.addEventListener('abort', () => { closed = true; });

      // Enviar estado inicial
      try {
        const { rows: [r] } = await pool.query(
          `SELECT COUNT(*) as total FROM pipeline WHERE asesor_id = $1 AND estado = 'pendiente' AND deleted_at IS NULL`,
          [parseInt(userId)]
        );
        send({ type: 'init', totalPendientes: parseInt(r.total) });
      } catch { /* silencioso */ }

      // Polling cada 30 segundos (reducido de 15s para aliviar BD)
      const interval = setInterval(async () => {
        if (closed) { clearInterval(interval); return; }
        try {
          const { rows: [r2] } = await pool.query(
            `SELECT COUNT(*) as total FROM pipeline WHERE asesor_id = $1 AND estado = 'pendiente' AND deleted_at IS NULL AND ultimo_cambio > $2`,
            [parseInt(userId), new Date(lastCheck).toISOString()]
          );
          const nuevos = parseInt(r2.total);
          if (nuevos > 0) send({ type: 'nuevos_leads', count: nuevos });
          lastCheck = Date.now();
        } catch { if (closed) clearInterval(interval); }
      }, 30000);

      // Doble seguridad: limpiar al cerrar el stream también
      const cleanup = () => { closed = true; clearInterval(interval); };
      req.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
