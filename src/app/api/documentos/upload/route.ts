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
const TEL_RE = /\b[6789]\d{8}\b/;  // Telfono espaol: 9 dgitos empezando por 6-9

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

function extractTelefonos(text: string): string[] {
  const found = new Set<string>();
  for (const line of text.split('\n')) {
    const clean = line.trim().replace(/^"|"$/g, '');
    if (!clean || clean.startsWith('#')) continue;
    const match = clean.match(TEL_RE);
    if (match) found.add(match[0]);
  }
  return Array.from(found);
}

function detectColumns(headers: string[]): { dniCol: string | null; telCol: string | null } {
  const dniKeywords = ['dni', 'documento', 'doc', 'identificacion', 'identificador', 'nif', 'nie', 'cedula'];
  const telExacta = 'TELEFONO_VOZ';
  let dniCol: string | null = null;
  let telCol: string | null = null;
  for (const h of headers) {
    const hclean = h.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!dniCol && dniKeywords.some(k => hclean.includes(k))) dniCol = h;
    // Solo TELEFONO_VOZ (ignorar otras columnas de telefono)
    if (!telCol && h.trim().toUpperCase() === telExacta) telCol = h;
  }
  return { dniCol, telCol };
}

function parseXlsx(buffer: ArrayBuffer): { dnis: string[]; telefonos: string[]; headers: string[]; rows: string[][] } {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows: string[][] = [];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cells: string[] = [];
    let hasValue = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      const val = cell ? String(cell.v ?? '').trim() : '';
      cells.push(val);
      if (val) hasValue = true;
    }
    if (hasValue) rawRows.push(cells);
  }

  const headers = rawRows.length > 0 ? rawRows[0] : [];
  const dataRows = rawRows.slice(1);
  const { dniCol, telCol } = detectColumns(headers);

  const dniIdx = dniCol ? headers.indexOf(dniCol) : -1;
  const telIdx = telCol ? headers.indexOf(telCol) : -1;

  console.log('[upload] Headers:', headers.filter(h => h).join(', '));
  console.log('[upload] DNI col:', dniCol, '(idx', dniIdx, ') TEL col (TELEFONO_VOZ):', telCol, '(idx', telIdx, ')');
  console.log('[upload] Total data rows:', dataRows.length);

  // Si hay columna DNI o TELEFONO_VOZ detectada, extraer por columna
  if (dniCol || telCol) {
    const dnis = new Set<string>();
    const telefonos = new Set<string>();
    for (const row of dataRows) {
      const tieneDni = dniIdx >= 0 && row[dniIdx] && row[dniIdx].match(DNI_RE);
      const tieneTel = telIdx >= 0 && row[telIdx] && row[telIdx].match(TEL_RE);

      if (tieneDni) {
        // Prioridad DNI: si tiene DOCUMENTO, usarlo (ignorar TELEFONO_VOZ en esa fila)
        dnis.add(tieneDni[0].toUpperCase());
      } else if (tieneTel) {
        // Solo TELEFONO_VOZ, sin DOCUMENTO
        telefonos.add(tieneTel[0]);
      }
      // Si no tiene ni DOCUMENTO ni TELEFONO_VOZ: se ignora la fila
    }
    return { dnis: Array.from(dnis), telefonos: Array.from(telefonos), headers, rows: rawRows };
  }

  // Sin columnas detectadas: buscar en todo el texto (compatibilidad hacia atras)
  const allText = dataRows.map(row => row.join(' ')).join('\n');
  return {
    dnis: extractDnis(allText),
    telefonos: extractTelefonos(allText),
    headers,
    rows: rawRows,
  };
}

// ── Determinar id_cliente segn tipo ──
function buildIdCliente(input: string): { id_cliente: string; tipo: string; numero: string } {
  const cleaned = input.toUpperCase().trim();
  // Es un NIE (empieza por X, Y, Z seguido de dgitos)
  if (/^[XYZ]\d/i.test(cleaned)) {
    return { id_cliente: `NIE_${cleaned}`, tipo: 'NIE', numero: cleaned };
  }
  // Es un NIF/letra (empieza por letra seguido de dgitos)
  if (/^[A-Z]\d/i.test(cleaned)) {
    return { id_cliente: `NIF_${cleaned}`, tipo: 'NIF', numero: cleaned };
  }
  // Es un DNI (7-8 dgitos + letra opcional)
  if (DNI_RE.test(cleaned) && cleaned.length >= 6) {
    return { id_cliente: `DNI_${cleaned}`, tipo: 'DNI', numero: cleaned };
  }
  // Es un telfono (9 dgitos)
  return { id_cliente: `TEL_${cleaned}`, tipo: 'TEL', numero: cleaned };
}
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
    let telefonos: string[] = [];
    let nombre_archivo = 'sin-nombre';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 });

      nombre_archivo = file.name;
      const buffer = await file.arrayBuffer();

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const parsed = parseXlsx(buffer);
        dnis = parsed.dnis;
        telefonos = parsed.telefonos;
      } else {
        const text = new TextDecoder().decode(buffer);
        dnis = extractDnis(text);
        telefonos = extractTelefonos(text);
      }
    } else {
      const body = await req.json();
      nombre_archivo = body.nombre_archivo || 'sin-nombre';
      dnis = body.dnis || [];
      telefonos = body.telefonos || [];
    }

    // Combinar DNIs y telefonos en una sola lista de entradas
    // Cada entrada tiene { input, source: 'dni' | 'tel' }
    const entradas: { input: string; source: 'dni' | 'tel' }[] = [];
    for (const d of dnis) entradas.push({ input: d, source: 'dni' });
    for (const t of telefonos) {
      // No duplicar si ya esta como DNI
      if (!dnis.includes(t)) entradas.push({ input: t, source: 'tel' });
    }

    if (entradas.length === 0) {
      return NextResponse.json({ error: 'No se detectaron DNIs ni telefonos validos en el archivo' }, { status: 400 });
    }

    // ── Clasificar y procesar ──
    let nuevos = 0, reabiertos = 0, ignorados = 0;
    const ignoradosDetalle: string[] = [];
    let nuevosDni = 0, nuevosTel = 0;

    for (const entrada of entradas) {
      const input = entrada.input;
      const { id_cliente, tipo, numero } = buildIdCliente(input);
      const tipo_persona = tipo === 'NIF' ? 'empresa' : 'natural';

      const clasificacion = await clasificarDni(id_cliente);

      if (clasificacion === 'nuevo') {
        await pool.query(
          `INSERT INTO clientes (id_cliente, tipo_documento, numero_documento, tipo_persona)
           VALUES ($1, $2, $3, $4) ON CONFLICT (id_cliente) DO NOTHING`,
          [id_cliente, tipo, numero, tipo_persona]
        );
        await pool.query(
          `INSERT INTO clientes_proyectos (id_cliente, proyecto_id, datos)
           VALUES ($1, (SELECT id FROM proyectos WHERE nombre = 'orange'), $2)
           ON CONFLICT (id_cliente, proyecto_id) DO NOTHING`,
          [id_cliente, JSON.stringify({ estado: 'pendiente' })]
        );
        nuevos++;
        if (entrada.source === 'tel') nuevosTel++; else nuevosDni++;
      } else if (clasificacion === 'reabrir') {
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
          ignoradosDetalle.push(`${numero} (${clasificacion.replace('ignorar_', '')})`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      archivo: nombre_archivo,
      total: entradas.length,
      nuevos,
      reabiertos,
      ignorados,
      dnis: nuevosDni,
      telefonos: nuevosTel,
      resumen: `${nuevos} nuevos (${nuevosDni} DNI + ${nuevosTel} tel), ${reabiertos} reabiertos, ${ignorados} ignorados`,
      ignoradosMuestra: ignoradosDetalle,
    });
  } catch (error: any) {
    console.error('[documentos/upload] Error:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
