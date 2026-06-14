/**
 * api/configuracion/route.ts — Configuración dinámica del sistema
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-roles';
import pool from '@/lib/db';

// GET — obtener todas o una clave específica (autenticado)
export async function GET(req: Request) {
  await requireAuth();
  const { searchParams } = new URL(req.url);
  const clave = searchParams.get('clave');
  try {
    if (clave) {
      const { rows: [c] } = await pool.query('SELECT * FROM configuracion WHERE clave = $1', [clave]);
      return NextResponse.json(c ? { [c.clave]: c.valor } : {});
    }
    const { rows } = await pool.query('SELECT * FROM configuracion ORDER BY clave');
    const config: Record<string, string> = {};
    for (const r of rows) config[r.clave] = r.valor;
    return NextResponse.json(config);
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST — actualizar una o varias claves (jefe/dev)
export async function POST(req: Request) {
  try {
    const { requireRole } = await import('@/lib/auth-roles');
    await requireRole('jefe_area', 'desarrollador');
    const data = await req.json();
    for (const [clave, valor] of Object.entries(data)) {
      await pool.query(
        `INSERT INTO configuracion (clave, valor, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (clave) DO UPDATE SET valor = $2, updated_at = now()`,
        [clave, String(valor)]
      );
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
