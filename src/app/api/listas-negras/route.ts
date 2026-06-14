/**
 * GET /api/listas-negras — Listar con filtros
 * GET /api/listas-negras?format=csv — Descargar CSV
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole } from '@/lib/auth-roles';

export async function GET(req: NextRequest) {
  try {
    await requireRole('supervisor', 'jefe_area', 'desarrollador');
    const { searchParams } = req.nextUrl;
    const proyecto = searchParams.get('proyecto_id') || '1';
    const motivo = searchParams.get('motivo');
    const format = searchParams.get('format');

    let query = `
      SELECT ln.*, c.nombre_razon_social, c.numero_documento, c.tipo_persona
      FROM listas_negras ln
      LEFT JOIN clientes c ON ln.id_cliente = c.id_cliente
      WHERE ln.proyecto_id = $1
    `;
    const params: any[] = [proyecto];
    let pi = 2;

    if (motivo) { query += ` AND ln.motivo = $${pi++}`; params.push(motivo); }
    query += ' ORDER BY ln.created_at DESC';

    const { rows } = await pool.query(query, params);

    if (format === 'csv') {
      const headers = ['Telefono', 'Motivo', 'Origen', 'Cliente', 'Documento', 'Tipo', 'Fecha'];
      const csvRows = [headers.join(',')];
      for (const r of rows) {
        csvRows.push([
          `"${r.telefono || ''}"`,
          `"${r.motivo || ''}"`,
          `"${r.origen || ''}"`,
          `"${(r.nombre_razon_social || '').replace(/"/g, '""')}"`,
          `"${r.numero_documento || ''}"`,
          `"${r.tipo_persona || ''}"`,
          `"${r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : ''}"`,
        ].join(','));
      }
      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename=listas_negras_${new Date().toISOString().split('T')[0]}.csv`,
        },
      });
    }

    return NextResponse.json(rows);
  } catch (e: any) {
    console.error('[api]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
