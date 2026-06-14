/**
 * app/api/pipeline/tipificar/route.ts — Tipificar lead post-llamada
 * 
 * Usa codificaciones dinámicas desde tipificaciones_config.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requirePipelineOwnership } from '@/lib/auth-roles';

async function cargarCodificaciones(proyecto_id: number = 1) {
  const { rows } = await pool.query(
    `SELECT codigo, tipo FROM tipificaciones_config WHERE proyecto_id = $1 AND activo = true`,
    [proyecto_id]
  );
  return {
    estados: rows.filter((r: any) => r.tipo === 'estado').map((r: any) => r.codigo),
    subEstados: rows.filter((r: any) => r.tipo === 'sub_estado').map((r: any) => r.codigo),
  };
}

export async function POST(req: Request) {
  try {
    const { id, estado, notas, callback_at, sub_estado, fin_permanencia, proyecto_id } = await req.json();
    if (!id || !estado) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });

    await requirePipelineOwnership(id);
    const config = await cargarCodificaciones(proyecto_id || 1);

    if (!config.estados.includes(estado)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    }
    if (sub_estado && !config.subEstados.includes(sub_estado)) {
      return NextResponse.json({ error: 'Sub-estado inválido' }, { status: 400 });
    }

    // Query parametrizada — sin string interpolation
    const setClauses: string[] = [];
    const params: any[] = [];
    let p = 1;

    // Si sub_estado indica reintento, vuelve a pendiente
    const reintento = sub_estado === 'numero_agregado' || sub_estado === 'contacto_confirmado';
    const estadoFinal = reintento ? 'pendiente' : estado;

    setClauses.push(`estado = $${p++}`);
    params.push(estadoFinal);
    setClauses.push(`ultimo_cambio = now()`);

    if (notas) {
      setClauses.push(`notas = $${p++}`);
      params.push(notas);
    }

    if (callback_at && !reintento) {
      setClauses.push(`callback_at = $${p++}::timestamptz`);
      params.push(callback_at);
    } else if (reintento) {
      setClauses.push(`callback_at = NULL`);
    }

    if (sub_estado) {
      setClauses.push(`sub_estado = $${p++}`);
      params.push(sub_estado);
      if (fin_permanencia) {
        setClauses.push(`fin_permanencia = $${p++}::date`);
        params.push(fin_permanencia);
      } else {
        setClauses.push(`fin_permanencia = NULL`);
      }
    } else {
      setClauses.push(`sub_estado = NULL`);
      setClauses.push(`fin_permanencia = NULL`);
    }

    setClauses.push(`updated_at = now()`);

    params.push(id);
    await pool.query(
      `UPDATE pipeline SET ${setClauses.join(', ')} WHERE id = $${p} AND deleted_at IS NULL`,
      params
    );
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[tipificar] Error:', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
