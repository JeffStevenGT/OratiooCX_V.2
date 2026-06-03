/**
 * app/api/documentos/upload/route.ts — Subida de DNIs
 * ====================================================
 * Acepta .csv, .txt, .xlsx. Parsea DNIs y los inserta como pendientes.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
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
  // Tomar la primera hoja
  const ws = wb.Sheets[wb.SheetNames[0]];
  // Convertir a texto: todas las celdas como string separadas por salto de línea
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

// ── POST: multipart o JSON ──
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';

    let dnis: string[] = [];
    let nombre_archivo = 'sin-nombre';

    if (contentType.includes('multipart/form-data')) {
      // ── Archivo directo (.xlsx, .csv, .txt) ──
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 });

      nombre_archivo = file.name;
      const buffer = await file.arrayBuffer();

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        dnis = parseXlsx(buffer);
      } else {
        // csv, txt, etc.
        const text = new TextDecoder().decode(buffer);
        dnis = extractDnis(text);
      }
    } else {
      // ── JSON (compatibilidad hacia atrás) ──
      const body = await req.json();
      nombre_archivo = body.nombre_archivo || 'sin-nombre';
      dnis = body.dnis || [];
    }

    if (dnis.length === 0) {
      return NextResponse.json({ error: 'No se detectaron DNIs válidos en el archivo' }, { status: 400 });
    }

    // Insertar clientes y asignar al proyecto orange
    for (const dni of dnis) {
      const tipo = /^[XYZ]\d/i.test(dni) ? 'NIE' : /^[A-Z]\d/i.test(dni) ? 'NIF' : 'DNI';
      const tipo_persona = tipo === 'NIF' ? 'empresa' : 'natural';
      await pool.query(
        `INSERT INTO clientes (id_cliente, tipo_documento, numero_documento, tipo_persona)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id_cliente) DO NOTHING`,
        [`${tipo}_${dni}`, tipo, dni, tipo_persona]
      );

      await pool.query(
        `INSERT INTO clientes_proyectos (id_cliente, proyecto_id, datos)
         VALUES ($1, (SELECT id FROM proyectos WHERE nombre = 'orange'),
                 $2)
         ON CONFLICT (id_cliente, proyecto_id) DO NOTHING`,
        [`${tipo}_${dni}`, JSON.stringify({ estado: 'pendiente' })]
      );
    }

    return NextResponse.json({
      success: true,
      count: dnis.length,
      archivo: nombre_archivo,
    });
  } catch (error: any) {
    console.error('[documentos/upload] Error:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
