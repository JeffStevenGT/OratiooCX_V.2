/**
 * app/api/clientes/export/route.ts — Exportación Excel detallada (estilo proyecto viejo)
 * GET /api/clientes/export?from=YYYY-MM-DD&to=YYYY-MM-DD&q=...&cima=SI&renove=SI&vars=...&tags=...&minL=N
 * 24 columnas, una fila por LINEA, campañas separadas por tipo.
 * Aplica los mismos filtros que la tabla de clientes.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import ExcelJS from 'exceljs';

const RENOVE_VALIOSOS = [
  'Renove mixto al mejor precio con máximo descuento',
  'Renove mixto al mejor precio con descuento',
  'Renove mixto al mejor precio',
  'Renove mixto',
];

interface Filtros {
  q: string;
  cima: string;
  renove: string;
  vars: string[];
  tags: string[];
  minL: number;
}

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

// ─── Transforma una row de BD en objeto filtrable (misma lógica que transformarCliente) ───
function transformarParaFiltro(r: any) {
  const datos = r.datos || {};
  const header = datos.header || {};
  const lineas: any[] = (datos.lineas || []).map((l: any) => ({
    numero: l.numero || '',
    tiene_renove: !!l.tiene_renove,
    variante_renove: l.variante_renove || 'N/A',
    es_cima: !!l.es_cima,
  }));

  const nombre = datos.estado === 'no_cliente'
    ? (header.nombre || 'NO ES CLIENTE')
    : (header.nombre || r.nombre_razon_social || 'N/A');

  const dni = (r.numero_documento || r.id_cliente || '').replace(/^(DNI_|NIE_|NIF_)/, '');
  const primera = lineas[0] || {};
  const linea_principal = primera.numero || 'N/A';
  const cima = datos.cima_global ? 'SI' : 'NO';

  return {
    r,         // row original para buildRow
    datos,     // datos originales
    header,    // header original
    dni,
    nombre,
    cima,
    linea_principal,
    lineas,
    ultima_extraccion: r.ultima_extraccion,
  };
}

// ─── Filtros (misma lógica que page.tsx) ───
function aplicaFiltros(clientes: any[], f: Filtros) {
  let result = [...clientes];

  // Búsqueda texto
  if (f.q.trim()) {
    const q = f.q.trim().toLowerCase();
    result = result.filter(c =>
      c.dni?.toLowerCase().includes(q) ||
      c.nombre?.toLowerCase().includes(q) ||
      c.linea_principal?.toLowerCase().includes(q) ||
      c.lineas?.some((l: any) => (l.numero || '').toLowerCase().includes(q))
    );
  }

  // CIMA
  if (f.cima) result = result.filter(c => c.cima === f.cima);

  // Renove
  if (f.renove === 'SI') {
    result = result.filter(c =>
      c.lineas?.some((l: any) => l.tiene_renove && RENOVE_VALIOSOS.includes(l.variante_renove))
    );
  } else if (f.renove === 'NO') {
    result = result.filter(c =>
      !c.lineas?.some((l: any) => l.tiene_renove && RENOVE_VALIOSOS.includes(l.variante_renove))
    );
  }

  // Variantes (mapeo de keys a texto)
  const VAR_KEY_MAP: Record<string, string> = {
    maximo: 'Renove mixto al mejor precio con máximo descuento',
    con_descuento: 'Renove mixto al mejor precio con descuento',
    mejor_precio: 'Renove mixto al mejor precio',
    renove_mixto: 'Renove mixto',
  };

  if (f.vars.length > 0) {
    const variantTexts = f.vars.map(vk => VAR_KEY_MAP[vk]).filter(Boolean);
    if (variantTexts.length > 0) {
      result = result.filter(c =>
        variantTexts.some(vt =>
          c.lineas?.some((l: any) => l.variante_renove === vt)
        )
      );
    }
  }

  // Tags (multidispositivo, otros)
  if (f.tags.length > 0) {
    result = result.filter(c =>
      f.tags.some(tk => {
        if (tk === 'multidispositivo') {
          return c.lineas?.some((l: any) => l.variante_renove?.toLowerCase().includes('multidispositivo'));
        }
        if (tk === 'otros') {
          return c.lineas?.some((l: any) =>
            l.variante_renove &&
            l.variante_renove !== 'N/A' &&
            ![...RENOVE_VALIOSOS, 'Renove Multidispositivo'].includes(l.variante_renove)
          );
        }
        return false;
      })
    );
  }

  // Mín líneas CIMA+Renove valioso
  if (f.minL > 1) {
    result = result.filter(c => {
      let count = 0;
      for (const l of (c.lineas || [])) {
        if (l.es_cima && l.tiene_renove && RENOVE_VALIOSOS.includes(l.variante_renove)) count++;
      }
      return count >= f.minL;
    });
  }

  return result;
}

// ─── Handler ───
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';

    // Filtros adicionales
    const filtros: Filtros = {
      q: searchParams.get('q') || '',
      cima: searchParams.get('cima') || '',
      renove: searchParams.get('renove') || '',
      vars: (searchParams.get('vars') || '').split(',').filter(Boolean),
      tags: (searchParams.get('tags') || '').split(',').filter(Boolean),
      minL: Math.max(1, parseInt(searchParams.get('minL') || '1')),
    };

    const batchSize = 500;
    const params: any[] = [];
    const conditions: string[] = [];
    conditions.push("cp.proyecto_id = p.pid");
    conditions.push("cp.datos->>'estado' IN ('completado', 'no_cliente', 'sin_datos', 'no_cargable', 'error')");
    if (from) { conditions.push(`cp.ultima_extraccion AT TIME ZONE 'America/Lima' >= $${params.length + 1}::date`); params.push(from); }
    if (to) { conditions.push(`cp.ultima_extraccion AT TIME ZONE 'America/Lima' < $${params.length + 1}::date + interval '1 day'`); params.push(to); }
    const where = conditions.join(' AND ');

    const baseQuery = `WITH proyecto AS (SELECT id AS pid FROM proyectos WHERE nombre = 'orange')
      SELECT c.id_cliente, c.tipo_documento, c.numero_documento, c.nombre_razon_social,
        c.tipo_persona, c.whatsapp_opt_in, c.whatsapp_numero, c.alertas_fidelizacion,
        cp.datos, cp.ultima_extraccion, cp.updated_at
      FROM clientes c CROSS JOIN proyecto p
      JOIN clientes_proyectos cp ON c.id_cliente = cp.id_cliente
      WHERE ${where} AND c.id_cliente > $${params.length + 1}
      ORDER BY c.id_cliente
      LIMIT ${batchSize}`;

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

    let cursor = '';
    let rowCount = 0;

    while (true) {
      const batchParams = [...params, cursor];
      const { rows } = await pool.query(baseQuery, batchParams);
      if (rows.length === 0) break;

      // Transformar y aplicar filtros al batch
      const transformados = rows.map(transformarParaFiltro);
      const filtrados = aplicaFiltros(transformados, filtros);

      for (const c of filtrados) {
        const datos = c.datos;
        const header = c.header;
        const lineas = datos.lineas || [];

        if (lineas.length === 0) {
          const row = buildRow(c.r.id_cliente, header, {}, '', c.r.ultima_extraccion);
          for (const k of Object.keys(row)) {
            if ((k as string).startsWith('camp_')) continue;
            if ((row as any)[k] === '' || (row as any)[k] === null || (row as any)[k] === undefined) (row as any)[k] = 'N/A';
          }
          sheet.addRow(row);
          rowCount++;
        } else {
          for (const l of lineas) {
            const row = buildRow(c.r.id_cliente, header, l, header?.direccion || '', c.r.ultima_extraccion);
            for (const k of Object.keys(row)) {
              if ((k as string).startsWith('camp_')) continue;
              if ((row as any)[k] === '' || (row as any)[k] === null || (row as any)[k] === undefined) (row as any)[k] = 'N/A';
            }
            sheet.addRow(row);
            rowCount++;
          }
        }
      }

      cursor = rows[rows.length - 1].id_cliente;
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
