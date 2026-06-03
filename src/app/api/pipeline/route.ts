import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const estado = url.searchParams.get('estado') || 'pendiente';

  try {
    const { rows } = await pool.query(
      `SELECT pl.id, pl.id_cliente, pl.estado, pl.ultimo_cambio, pl.asesor_id,
              c.nombre_razon_social as cliente_nombre,
              p.nombre_visible as proyecto
       FROM pipeline pl
       JOIN clientes c ON pl.id_cliente = c.id_cliente
       JOIN proyectos p ON pl.proyecto_id = p.id
       WHERE pl.estado = $1 AND pl.deleted_at IS NULL
       ORDER BY pl.ultimo_cambio DESC
       LIMIT 50`,
      [estado]
    );
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { id, estado } = await req.json();

  try {
    await pool.query(
      'UPDATE pipeline SET estado = $1, ultimo_cambio = now() WHERE id = $2',
      [estado, id]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
