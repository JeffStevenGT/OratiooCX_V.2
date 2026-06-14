/**
 * app/api/pipeline/intento/route.ts — Registrar intento de llamada
 * 
 * Sub-estados soportados:
 *   - contactado: contestó, conversación efectiva
 *   - no_contesta: no contestó
 *   - buzón: contestó buzón/contestador
 *   - numero_agregado: cliente dio un número nuevo → guarda + permite llamar YA
 *   - contacto_confirmado: cliente confirmó cuál es su número principal
 *   - numero_nuevo: legacy, mismo comportamiento que numero_agregado
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requirePipelineOwnership } from '@/lib/auth-roles';

export async function POST(req: Request) {
  try {
    const { id_cliente, pipeline_id, numero, resultado, notas } = await req.json();
    if (!id_cliente || !numero) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });

    // Verificar ownership si viene pipeline_id
    if (pipeline_id) {
      await requirePipelineOwnership(pipeline_id);
    }

    // Guardar intento en historial
    await pool.query(
      `INSERT INTO historial (id_cliente, tipo, proyecto_id, descripcion, datos)
       VALUES ($1, 'llamada', 1, $2, $3)`,
      [id_cliente, `Intento a ${numero}: ${resultado}`, JSON.stringify({ numero, resultado, notas: notas || '', pipeline_id })]
    );

    // ── Número nuevo / agregado por el asesor ──
    if (resultado === 'numero_nuevo' || resultado === 'numero_agregado') {
      // Agregar sin duplicar en el nuevo formato estructurado
      await pool.query(
        `UPDATE clientes 
         SET telefonos_v2 = telefonos_agregar(telefonos_v2, $2, 'agregado', 'asesor'),
             telefonos = CASE WHEN NOT (telefonos @> $3::jsonb) THEN telefonos || $3::jsonb ELSE telefonos END,
             updated_at = now()
         WHERE id_cliente = $1`,
        [id_cliente, numero, JSON.stringify([numero])]
      );
      // No avanzar pipeline — misma ronda, el asesor puede llamar al nuevo número
    }

    // ── Confirmado como número de contacto ──
    if (resultado === 'contacto_confirmado') {
      // Marcar este número como el principal del cliente
      await pool.query(
        `UPDATE clientes 
         SET telefonos_v2 = telefonos_marcar_contacto(telefonos_v2, $2),
             updated_at = now()
         WHERE id_cliente = $1`,
        [id_cliente, numero]
      );
    }

    // ── Si contestó, actualizar pipeline ──
    if (resultado === 'contactado' && pipeline_id) {
      await pool.query(
        `UPDATE pipeline SET estado = 'contactado', ultimo_cambio = now(),
         ultimo_intento_ronda = now()
         WHERE id = $1 AND deleted_at IS NULL`,
        [pipeline_id]
      );
    }

    // ── Actualizar timestamp de ronda (cualquier intento) ──
    if (pipeline_id) {
      await pool.query(
        `UPDATE pipeline SET ultimo_intento_ronda = now() WHERE id = $1 AND deleted_at IS NULL`,
        [pipeline_id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
