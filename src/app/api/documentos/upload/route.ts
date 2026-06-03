import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  const { nombre_archivo, dnis } = await req.json();

  if (!dnis || dnis.length === 0) {
    return NextResponse.json({ error: 'Sin DNIs' }, { status: 400 });
  }

  try {
    // Insertar clientes
    for (const dni of dnis) {
      const tipo = /^[XYZ]\d/i.test(dni) ? 'NIE' : /^[A-Z]\d/i.test(dni) ? 'NIF' : 'DNI';
      await pool.query(
        `INSERT INTO clientes (id_cliente, tipo_documento, numero_documento, tipo_persona)
         VALUES ($1, $2, $3, 'natural')
         ON CONFLICT (id_cliente) DO NOTHING`,
        [`${tipo}_${dni}`, tipo, dni]
      );

      // Insertar en proyecto orange como pendiente
      await pool.query(
        `INSERT INTO clientes_proyectos (id_cliente, proyecto_id, datos)
         VALUES ($1, (SELECT id FROM proyectos WHERE nombre = 'orange'), 
                 $2)
         ON CONFLICT (id_cliente, proyecto_id) DO NOTHING`,
        [`${tipo}_${dni}`, JSON.stringify({ estado: 'pendiente' })]
      );
    }

    return NextResponse.json({ success: true, count: dnis.length });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
