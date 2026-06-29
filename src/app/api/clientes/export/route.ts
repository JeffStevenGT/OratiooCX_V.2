/**
 * app/api/clientes/export/route.ts — Exportación Excel detallada (estilo proyecto viejo)
 * GET /api/clientes/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=xlsx
 * 24 columnas, una fila por LINEA, campañas separadas por tipo.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import ExcelJS from 'exceljs';

function detectarTipoDoc(doc: string) {
  if (!doc) return 'DNI';
  const docUp = doc.toUpperCase();
  if (/^[XYZ]\d{7}[A-Z]$/.test(docUp)) return 'NIE';
  if (/^[A-Z]\d{8}$/.test(docUp)) return 'NIF';
  if (/^\d{7,8}[A-Z]$/.test(docUp)) return 'DNI';
  return 'DNI';
}

function extraerCP(direccion: string) {
  if (!direccion) return '';
  const match = direccion.match(/\b(\d{5})\b/);
  return match ? match[1] : '';
}

function limpiarNumero(num: string) {
  if (!num) return '';
  const digits = num.replace(/\D/g, '');
  return digits.slice(-9);
}

function limpiarNombre(nombre: string) {
  if (!nombre) return '';
  return nombre.replace(/^[.\-\s]+/, '').toUpperCase().trim();
}

function buildRow(doc: string, header: any, linea: any, direccion: string, ultimaExtraccion: string) {
  const campanas = linea.campanas_extra || [];
  const porTipo: Record<string, string[]> = {};
  for (const c of campanas) {
    const t = (c.tipo || 'Otros').trim();
    const txt = (c.texto || '').trim();
    if (!txt) continue;
    if (!porTipo[t]) porTipo[t] = [];
    porTipo[t].push(txt);
  }

  // Fecha de análisis = fecha de procesamiento del bot (no activación de línea)
  const ts = ultimaExtraccion ? new Date(ultimaExtraccion) : null;
  const fecha = ts ? ts.toISOString().slice(0, 10) : '';

  return {
    fecha_analisis: fecha,
    tipo_busqueda: 'DNI',
    documento: (doc || '').replace(/^(DNI_|NIE_|NIF_)/, ''),
    tipoDoc: detectarTipoDoc(doc),
    telefonos_busqueda: '',
    nombre: limpiarNombre(header?.nombre || ''),
    apellidos: '',
    telefono: limpiarNumero(linea.numero || ''),
    email: '',
    cp: extraerCP(header?.direccion || direccion || ''),
    paquete_principal: header?.paquete || 'N/A',
    producto: linea.producto || 'N/A',
    estado_linea: linea.estado_linea_resumen || 'N/A',
    permanencia: linea.permanencia || 'N/A',
    permanencia_fecha: linea.permanencia_fecha || '',
    consumo: linea.consumo || 'N/A',
    venta_plazos: linea.venta_plazos || 'N/A',
    camp_destacadas: (porTipo['Destacadas'] || []).join(' | '),
    camp_renove: (porTipo['Renove'] || []).join(' | '),
    camp_bonos: (porTipo['Bonos y Descuen.'] || []).join(' | '),
    camp_cambio_tarifa: (porTipo['Cambio Tarifa'] || []).join(' | '),
    camp_sva: (porTipo['SVA'] || []).join(' | '),
    camp_otros: (porTipo['Otros'] || []).join(' | '),
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const batchSize = 500;

    const params: any[] = [];
    const conditions: string[] = [];
    conditions.push("cp.proyecto_id = p.pid");
    conditions.push("cp.datos->>'estado' IN ('completado', 'no_cliente')");
    if (from) { conditions.push(`cp.ultima_extraccion >= $${params.length + 1}::date`); params.push(from); }
    if (to) { conditions.push(`cp.ultima_extraccion < $${params.length + 1}::date + interval '1 day'`); params.push(to); }
    const where = conditions.join(' AND ');

    const baseQuery = `WITH proyecto AS (SELECT id AS pid FROM proyectos WHERE nombre = 'orange')
      SELECT c.id_cliente, c.tipo_documento, c.numero_documento, c.nombre_razon_social,
        c.tipo_persona, c.whatsapp_opt_in, c.whatsapp_numero, c.alertas_fidelizacion,
        cp.datos, cp.ultima_extraccion, cp.updated_at
      FROM clientes c CROSS JOIN proyecto p
      JOIN clientes_proyectos cp ON c.id_cliente = cp.id_cliente
      WHERE ${where}
      ORDER BY cp.ultima_extraccion DESC NULLS LAST`;

    // ── Build workbook ──
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Clientes');

    sheet.columns = [
      { header: 'Fecha análisis', key: 'fecha_analisis', width: 14 },
      { header: 'Tipo Búsqueda', key: 'tipo_busqueda', width: 14 },
      { header: 'documento', key: 'documento', width: 16 },
      { header: 'tipoDoc', key: 'tipoDoc', width: 10 },
      { header: 'Teléfono búsqueda', key: 'telefonos_busqueda', width: 18 },
      { header: 'nombre', key: 'nombre', width: 40 },
      { header: 'apellidos', key: 'apellidos', width: 5 },
      { header: 'telefono', key: 'telefono', width: 18 },
      { header: 'email', key: 'email', width: 5 },
      { header: 'CP', key: 'cp', width: 8 },
      { header: 'Paquete Principal', key: 'paquete_principal', width: 28 },
      { header: 'Producto', key: 'producto', width: 35 },
      { header: 'Estado Línea', key: 'estado_linea', width: 18 },
      { header: 'Permanencia', key: 'permanencia', width: 25 },
      { header: 'Perm. Vence', key: 'permanencia_fecha', width: 14 },
      { header: 'Consumo', key: 'consumo', width: 15 },
      { header: 'Venta a Plazos', key: 'venta_plazos', width: 20 },
      { header: 'Destacadas', key: 'camp_destacadas', width: 25 },
      { header: 'Renove', key: 'camp_renove', width: 30 },
      { header: 'Bonos y Desc.', key: 'camp_bonos', width: 30 },
      { header: 'Cambio Tarifa', key: 'camp_cambio_tarifa', width: 25 },
      { header: 'SVA', key: 'camp_sva', width: 25 },
      { header: 'Otros', key: 'camp_otros', width: 35 },
    ];

    // Estilo encabezados
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    let offset = 0;
    let rowCount = 0;

    while (true) {
      const { rows } = await pool.query(
        baseQuery + ` LIMIT ${batchSize} OFFSET ${offset}`,
        params
      );
      if (rows.length === 0) break;

      for (const r of rows) {
        const datos = r.datos || {};
        const header = datos.header || {};
        const lineas = datos.lineas || [];

        if (lineas.length === 0) {
          const row = buildRow(r.id_cliente, header, {}, '', r.ultima_extraccion);
          for (const k of Object.keys(row)) {
            if ((k as string).startsWith('camp_')) continue;
            if ((row as any)[k] === '' || (row as any)[k] === null || (row as any)[k] === undefined) (row as any)[k] = 'N/A';
          }
          sheet.addRow(row);
          rowCount++;
        } else {
          for (const l of lineas) {
            const row = buildRow(r.id_cliente, header, l, header?.direccion || '', r.ultima_extraccion);
            for (const k of Object.keys(row)) {
              if ((k as string).startsWith('camp_')) continue;
              if ((row as any)[k] === '' || (row as any)[k] === null || (row as any)[k] === undefined) (row as any)[k] = 'N/A';
            }
            sheet.addRow(row);
            rowCount++;
          }
        }
      }

      offset += batchSize;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const today = new Date().toISOString().split('T')[0];
    const filename = `ORATIOO_CX_${today}.xlsx`;

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('[export] Error:', error.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
