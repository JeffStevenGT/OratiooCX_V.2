/**
 * GET /api/dashboard/extracciones — Stats de extracción del bot
 * Soporta ?periodo=hoy|semana|mes|trimestre|6m|all y ?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const proyectoId = parseInt(searchParams.get('proyecto_id') || '1');
  const periodo = searchParams.get('periodo') || 'hoy';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  let fechaCorte: string;
  let fechaHasta: string | null = null;
  const now = new Date();

  if (from || to) {
    fechaCorte = from || '2024-01-01';
    fechaHasta = to || now.toISOString().split('T')[0];
  } else {
    switch (periodo) {
      case 'hoy':
        fechaCorte = now.toISOString().split('T')[0];
        break;
      case 'semana': {
        const d = new Date(now); d.setDate(d.getDate() - 7);
        fechaCorte = d.toISOString().split('T')[0];
        break;
      }
      case 'mes':
        fechaCorte = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        break;
      case 'trimestre': {
        const d = new Date(now); d.setMonth(d.getMonth() - 3);
        fechaCorte = d.toISOString().split('T')[0];
        break;
      }
      case '6m': {
        const d = new Date(now); d.setMonth(d.getMonth() - 6);
        fechaCorte = d.toISOString().split('T')[0];
        break;
      }
      default:
        fechaCorte = '2024-01-01';
    }
  }

  // Cláusula de fecha: >= fechaCorte AND (opcional) < fechaHasta + 1
  const dateFilter = fechaHasta
    ? `AND cp.ultima_extraccion >= $2::date AND cp.ultima_extraccion < ($3::date + interval '1 day')`
    : `AND cp.ultima_extraccion >= $2::date`;
  const dateParams = fechaHasta ? [proyectoId, fechaCorte, fechaHasta] : [proyectoId, fechaCorte];

  try {
    // ── 1. Total clientes por estado en el período ──
    const { rows: [estados] } = await pool.query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE datos->>'estado' = 'completado')::int as completados,
        COUNT(*) FILTER (WHERE datos->>'estado' = 'no_cliente')::int as no_cliente,
        COUNT(*) FILTER (WHERE datos->>'estado' = 'sin_datos')::int as sin_datos,
        COUNT(*) FILTER (WHERE datos->>'estado' = 'error')::int as errores
      FROM clientes_proyectos cp
      WHERE cp.proyecto_id = $1 ${dateFilter}
    `, dateParams);

    // ── 2. CIMA count ──
    const { rows: [cima] } = await pool.query(`
      SELECT COUNT(*)::int as total
      FROM clientes_proyectos cp
      WHERE cp.proyecto_id = $1
        ${dateFilter}
        AND cp.datos->>'estado' = 'completado'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(cp.datos->'lineas') l
          WHERE (l->>'es_cima')::boolean = true
        )
    `, dateParams);

    // ── 3. Variantes Renove ──
    const VARIANTES_VALIOSAS = [
      'Renove mixto al mejor precio con máximo descuento',
      'Renove mixto al mejor precio con descuento',
      'Renove mixto al mejor precio',
      'Renove mixto',
    ];
    const variantesParams = [...dateParams, ...VARIANTES_VALIOSAS];

    const { rows: variantesRows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(cp.datos->'lineas') l
          WHERE l->>'variante_renove' = $${dateParams.length + 1}
        ))::int as max_descuento,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(cp.datos->'lineas') l
          WHERE l->>'variante_renove' = $${dateParams.length + 2}
        ))::int as con_descuento,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(cp.datos->'lineas') l
          WHERE l->>'variante_renove' = $${dateParams.length + 3}
        ))::int as mejor_precio,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(cp.datos->'lineas') l
          WHERE l->>'variante_renove' = $${dateParams.length + 4}
        ))::int as renove_mixto,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(cp.datos->'lineas') l
          WHERE l->>'variante_renove' = 'Renove Multidispositivo'
        ))::int as multidispositivo,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(cp.datos->'lineas') l
          WHERE l->>'variante_renove' IS NOT NULL
            AND l->>'variante_renove' NOT IN ($${dateParams.length + 1}, $${dateParams.length + 2}, $${dateParams.length + 3}, $${dateParams.length + 4}, 'Renove Multidispositivo', 'N/A')
        ))::int as otros
      FROM clientes_proyectos cp
      WHERE cp.proyecto_id = $1
        ${dateFilter}
        AND cp.datos->>'estado' = 'completado'
    `, variantesParams);

    const variantes = variantesRows[0] || { max_descuento: 0, con_descuento: 0, mejor_precio: 0, renove_mixto: 0, multidispositivo: 0, otros: 0 };
    const renoveMixto = variantes.max_descuento + variantes.con_descuento + variantes.mejor_precio + variantes.renove_mixto;

    // ── 4. CIMA + Renove ──
    const { rows: [cimaRenove] } = await pool.query(`
      SELECT COUNT(*)::int as total
      FROM clientes_proyectos cp
      WHERE cp.proyecto_id = $1
        ${dateFilter}
        AND cp.datos->>'estado' = 'completado'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(cp.datos->'lineas') l
          WHERE (l->>'es_cima')::boolean = true
        )
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(cp.datos->'lineas') l
          WHERE l->>'variante_renove' IN ($${dateParams.length + 1}, $${dateParams.length + 2}, $${dateParams.length + 3}, $${dateParams.length + 4})
        )
    `, variantesParams);

    const total = (estados?.total || 1);
    const tasaExtraccion = Math.round(((cimaRenove?.total || 0) / total) * 100);

    // ── 5. Chart: últimos 7 días ──
    const chartData: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dia = d.toISOString().split('T')[0];
      const { rows: [diaStats] } = await pool.query(`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE datos->>'estado' = 'completado')::int as completados,
          COUNT(*) FILTER (WHERE datos->>'estado' = 'no_cliente')::int as no_cliente,
          COUNT(*) FILTER (WHERE datos->>'estado' = 'sin_datos')::int as sin_datos,
          COUNT(*) FILTER (WHERE datos->>'estado' = 'error')::int as errores
        FROM clientes_proyectos
        WHERE proyecto_id = $1
          AND ultima_extraccion::date = $2::date
      `, [proyectoId, dia]);

      chartData.push({
        dia,
        label: d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' }),
        completados: diaStats?.completados || 0,
        no_cliente: diaStats?.no_cliente || 0,
        sin_datos: diaStats?.sin_datos || 0,
        error: diaStats?.errores || 0,
        total: diaStats?.total || 0,
      });
    }

    return NextResponse.json({
      stats: {
        total: estados?.total || 0,
        completados: estados?.completados || 0,
        cima: cima?.total || 0,
        renoveMixto,
        cimaRenove: cimaRenove?.total || 0,
        tasaExtraccion,
        noCliente: estados?.no_cliente || 0,
        sinDatos: estados?.sin_datos || 0,
        errores: estados?.errores || 0,
      },
      variantes: {
        maxDescuento: variantes.max_descuento,
        conDescuento: variantes.con_descuento,
        mejorPrecio: variantes.mejor_precio,
        renoveMixto: variantes.renove_mixto,
        multidispositivo: variantes.multidispositivo,
        otros: variantes.otros,
      },
      chart: chartData,
      periodo: from ? 'custom' : periodo,
      fechaCorte,
    });
  } catch (e: any) {
    console.error('[api] extracciones', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
