/**
 * app/api/vpbx/originate/route.ts — Click2Call Endpoint
 */

import { NextResponse } from 'next/server';
import { originateCall } from '@/lib/vpbx';
import pool from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { from, to, dni } = await req.json();
    if (!from || !to) {
      return NextResponse.json({ error: 'from y to son requeridos' }, { status: 400 });
    }

    // 1. Lanzar llamada VPBX
    const result = await originateCall(from, to);

    // 2. Registrar en historial
    if (dni) {
      const id_cliente = dni.startsWith('DNI_') || dni.startsWith('NIE_') || dni.startsWith('NIF_')
        ? dni
        : `DNI_${dni}`;
      await pool.query(
        `INSERT INTO historial (id_cliente, tipo, proyecto_id, descripcion, datos)
         VALUES ($1, 'llamada', 1, 'Click2Call iniciado', $2)`,
        [id_cliente, JSON.stringify({ from, to, callId: result?.variables?.callId })]
      );
    }

    return NextResponse.json({ success: true, callId: result?.variables?.callId });
  } catch (error: any) {
    console.error('[originate] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
