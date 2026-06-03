/**
 * app/api/pipeline/intento/route.ts — Registrar intento de llamada por línea
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { id_cliente, pipeline_id, numero, resultado, notas } = await req.json();
    if (!id_cliente || !numero) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });

    // Guardar intento en historial
    await pool.query(
      `INSERT INTO historial (id_cliente, tipo, proyecto_id, descripcion, datos)
       VALUES ($1, 'llamada', 1, $2, $3)`,
      [id_cliente, `Intento a ${numero}: ${resultado}`, JSON.stringify({ numero, resultado, notas: notas || '', pipeline_id })]
    );

    // Si es un número nuevo (no extraído por el bot), guardarlo como teléfono extra
    if (resultado === 'numero_nuevo') {
      await pool.query(
        `UPDATE clientes SET telefonos = telefonos || $2::jsonb, updated_at = now()
         WHERE id_cliente = $1`,
        [id_cliente, JSON.stringify([numero])]
      );
    }

    // Si contestó, actualizar pipeline
    if (resultado === 'contactado') {
      await pool.query(
        `UPDATE pipeline SET estado = 'contactado', ultimo_cambio = now()
         WHERE id = $1 AND deleted_at IS NULL`,
        [pipeline_id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
