import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const { rows: [cliente] } = await pool.query(
      'SELECT * FROM clientes WHERE id_cliente = $1',
      [id]
    );

    if (!cliente) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    // Cargar proyectos
    const { rows: proyectos } = await pool.query(
      `SELECT p.nombre_visible as nombre, cp.datos
       FROM clientes_proyectos cp
       JOIN proyectos p ON cp.proyecto_id = p.id
       WHERE cp.id_cliente = $1`,
      [id]
    );

    // Cargar historial
    const { rows: historial } = await pool.query(
      `SELECT tipo, descripcion, datos, created_at
       FROM historial
       WHERE id_cliente = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [id]
    );

    // Cargar pipeline activo
    const { rows: pipeline } = await pool.query(
      `SELECT pl.estado, pl.ultimo_cambio, p.nombre_visible as proyecto
       FROM pipeline pl
       JOIN proyectos p ON pl.proyecto_id = p.id
       WHERE pl.id_cliente = $1 AND pl.deleted_at IS NULL
       ORDER BY pl.ultimo_cambio DESC`,
      [id]
    );

    return NextResponse.json({
      ...cliente,
      proyectos_datos: proyectos,
      historial,
      pipeline,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
