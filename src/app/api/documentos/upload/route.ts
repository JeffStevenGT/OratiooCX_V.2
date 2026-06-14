/**
 * app/api/documentos/upload/route.ts — Subida de DNIs con deduplicación
 * =====================================================================
 * Acepta .csv, .txt, .xlsx. Parsea DNIs, valida duplicados,
 * y los inserta como pendientes para el bot.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole } from '@/lib/auth-roles';
import * as XLSX from 'xlsx';

// ── Helpers ──
const DNI_RE = /\b[A-Za-z]?\d{7,8}[A-Za-z]?\b/;

function extractDnis(text: string): string[] {
  const found = new Set<string>();
  for (const line of text.split('\n')) {
    const clean = line.trim().replace(/^"|"$/g, '');
    if (!clean || clean.startsWith('#')) continue;
    const match = clean.match(DNI_RE);
    if (match && match[0].length >= 6) found.add(match[0].toUpperCase());
  }
  return Array.from(found);
}

function parseXlsx(buffer: ArrayBuffer): string[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: string[] = [];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cells: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      cells.push(cell ? String(cell.v ?? '').trim() : '');
    }
    rows.push(cells.join(' '));
  }
  return extractDnis(rows.join('\n'));
}

// ── Clasificar un DNI ──
async function clasificarDni(id_cliente: string): Promise<'nuevo' | 'ignorar_activo' | 'ignorar_cooldown' | 'ignorar_reciente' | 'reabrir'> {
  // Ver si existe el cliente
  const { rows: [cliente] } = await pool.query(
    `SELECT id_cliente FROM clientes WHERE id_cliente = $1`, [id_cliente]
  );
  if (!cliente) return 'nuevo';

  // Ver pipeline activo
  const { rows: [pipe] } = await pool.query(
    `SELECT estado, ultimo_cambio, deleted_at,
            COALESCE(intentos, 0) as intentos
     FROM pipeline
     WHERE id_cliente = $1 AND proyecto_id = 1
     ORDER BY created_at DESC LIMIT 1`,
    [id_cliente]
  );

  if (!pipe || pipe.deleted_at) {
    // Sin pipeline o liberado → es nuevo para el sistema
    return 'nuevo';
  }

  const diasDesdeCierre = pipe.ultimo_cambio
    ? Math.floor((Date.now() - new Date(pipe.ultimo_cambio).getTime()) / 86400000)
    : 999;

  // Pipeline activo (el asesor lo está trabajando)
  if (['pendiente', 'contactado', 'interesado', 'negociacion'].includes(pipe.estado)) {
    if (pipe.intentos > 0) return 'ignorar_cooldown'; // ya se intentó, en ciclo
    if (diasDesdeCierre < 7) return 'ignorar_activo'; // recién asignado
    return 'ignorar_activo';
  }

  // No contesta → el sistema ya lo maneja
  if (pipe.estado === 'no_contesta') {
    return 'ignorar_cooldown';
  }

  // Cerrado (venta, no_interesa, tramitado, activado)
  if (diasDesdeCierre > 30) return 'reabrir';
  return 'ignorar_reciente';
}

// ── POST: multipart o JSON ──
export async function POST(req: Request) {
  try {
    await requireRole('jefe_area', 'supervisor', 'desarrollador');

    const contentType = req.headers.get('content-type') || '';
    let dnis: string[] = [];
    let nombre_archivo = 'sin-nombre';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 });

      nombre_archivo = file.name;
      const buffer = await file.arrayBuffer();

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        dnis = parseXlsx(buffer);
      } else {
        const text = new TextDecoder().decode(buffer);
        dnis = extractDnis(text);
      }
    } else {
      const body = await req.json();
      nombre_archivo = body.nombre_archivo || 'sin-nombre';
      dnis = body.dnis || [];
    }

    if (dnis.length === 0) {
      return NextResponse.json({ error: 'No se detectaron DNIs válidos en el archivo' }, { status: 400 });
    }

    // ── Clasificar y procesar ──
    let nuevos = 0, reabiertos = 0, ignorados = 0;
    const ignoradosDetalle: string[] = [];

    for (const dni of dnis) {
      const tipo = /^[XYZ]\d/i.test(dni) ? 'NIE' : /^[A-Z]\d/i.test(dni) ? 'NIF' : 'DNI';
      const tipo_persona = tipo === 'NIF' ? 'empresa' : 'natural';
      const id_cliente = `${tipo}_${dni}`;

      const clasificacion = await clasificarDni(id_cliente);

      if (clasificacion === 'nuevo') {
        await pool.query(
          `INSERT INTO clientes (id_cliente, tipo_documento, numero_documento, tipo_persona)
           VALUES ($1, $2, $3, $4) ON CONFLICT (id_cliente) DO NOTHING`,
          [id_cliente, tipo, dni, tipo_persona]
        );
        await pool.query(
          `INSERT INTO clientes_proyectos (id_cliente, proyecto_id, datos)
           VALUES ($1, (SELECT id FROM proyectos WHERE nombre = 'orange'), $2)
           ON CONFLICT (id_cliente, proyecto_id) DO NOTHING`,
          [id_cliente, JSON.stringify({ estado: 'pendiente' })]
        );
        nuevos++;
      } else if (clasificacion === 'reabrir') {
        // Reabrir: actualizar datos en clientes_proyectos como pendiente
        await pool.query(
          `UPDATE clientes_proyectos
           SET datos = jsonb_set(datos, '{estado}', '"pendiente"'),
               updated_at = now()
           WHERE id_cliente = $1 AND proyecto_id = 1`,
          [id_cliente]
        );
        reabiertos++;
      } else {
        ignorados++;
        if (ignoradosDetalle.length < 5) {
          ignoradosDetalle.push(`${dni} (${clasificacion.replace('ignorar_', '')})`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      archivo: nombre_archivo,
      total: dnis.length,
      nuevos,
      reabiertos,
      ignorados,
      resumen: `${nuevos} nuevos, ${reabiertos} reabiertos, ${ignorados} ignorados`,
      ignoradosMuestra: ignoradosDetalle,
    });
  } catch (error: any) {
    console.error('[documentos/upload] Error:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
