/**
 * app/api/pipeline/tipificar/route.ts — Tipificar lead post-llamada
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { id, estado, notas, callback_at } = await req.json();
    if (!id || !estado) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });

    const VALIDOS = ['pendiente','contactado','interesado','negociacion','venta','no_interesa','no_contesta'];
    if (!VALIDOS.includes(estado)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });

    const updates = [`estado = '${estado}'`, 'ultimo_cambio = now()'];
    if (notas) updates.push(`notas = '${notas.replace(/'/g, "''")}'`);
    if (callback_at) updates.push(`callback_at = '${callback_at}'`);

    await pool.query(`UPDATE pipeline SET ${updates.join(', ')} WHERE id = $1 AND deleted_at IS NULL`, [id]);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
