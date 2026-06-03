/**
 * app/api/internal/bot-sync/route.ts — Endpoint Interno para Bots
 * ================================================================
 * Guarda resultados del bot Y detecta cambios vs análisis anterior.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const BOT_API_KEY = process.env.BOT_API_KEY || 'oratioo-bot-internal-key';

function detectarCambios(datosViejos: any, datosNuevos: any): any[] {
  const cambios: any[] = [];
  const lineasViejas: any[] = datosViejos?.lineas || [];
  const lineasNuevas: any[] = datosNuevos?.lineas || [];

  // Mapa número → línea vieja
  const mapaViejo: Record<string, any> = {};
  for (const l of lineasViejas) mapaViejo[l.numero] = l;

  // Mapa número → línea nueva
  const mapaNuevo: Record<string, any> = {};
  for (const l of lineasNuevas) mapaNuevo[l.numero] = l;

  const todasLasLineas = new Set([...Object.keys(mapaViejo), ...Object.keys(mapaNuevo)]);

  for (const num of todasLasLineas) {
    const vieja = mapaViejo[num];
    const nueva = mapaNuevo[num];

    if (!vieja && nueva) {
      // Línea nueva
      cambios.push({
        tipo: 'linea_nueva', linea_numero: num,
        valor_nuevo: nueva.plan || 'N/A',
        datos_extra: { es_cima: nueva.es_cima, tiene_renove: nueva.tiene_renove },
      });
      continue;
    }
    if (vieja && !nueva) {
      // Línea eliminada (dada de baja)
      cambios.push({
        tipo: 'linea_eliminada', linea_numero: num,
        valor_anterior: vieja.plan || 'N/A',
        datos_extra: { es_cima: vieja.es_cima, tenia_renove: vieja.tiene_renove },
      });
      continue;
    }
    if (!vieja || !nueva) continue;

    // Comparar campos
    if (!vieja.tiene_renove && nueva.tiene_renove) {
      cambios.push({ tipo: 'renove_nuevo', linea_numero: num, valor_nuevo: nueva.variante_renove || 'Renove' });
    } else if (vieja.tiene_renove && nueva.tiene_renove && vieja.variante_renove !== nueva.variante_renove) {
      cambios.push({ tipo: 'renove_cambio', linea_numero: num, valor_anterior: vieja.variante_renove, valor_nuevo: nueva.variante_renove });
    }

    if (vieja.permanencia !== nueva.permanencia && nueva.permanencia) {
      const vencio = nueva.permanencia?.toLowerCase?.().includes('venci') || false;
      cambios.push({ tipo: vencio ? 'permanencia_vencida' : 'permanencia_cambio', linea_numero: num, valor_anterior: vieja.permanencia || '', valor_nuevo: nueva.permanencia || '' });
    }

    if (vieja.consumo !== nueva.consumo && nueva.consumo) {
      cambios.push({ tipo: 'consumo_cambio', linea_numero: num, valor_anterior: vieja.consumo || '', valor_nuevo: nueva.consumo || '' });
    }

    const viejaEstado = JSON.stringify(vieja.estado || {});
    const nuevaEstado = JSON.stringify(nueva.estado || {});
    if (viejaEstado !== nuevaEstado) {
      cambios.push({ tipo: 'estado_cambio', linea_numero: num, valor_anterior: viejaEstado, valor_nuevo: nuevaEstado });
    }

    if (!vieja.es_cima && nueva.es_cima) {
      cambios.push({ tipo: 'cima_nuevo', linea_numero: num, valor_nuevo: 'SI' });
    } else if (vieja.es_cima && !nueva.es_cima) {
      cambios.push({ tipo: 'cima_perdido', linea_numero: num, valor_anterior: 'SI' });
    }

    if (!vieja.tiene_tv && nueva.tiene_tv) {
      cambios.push({ tipo: 'tv_nuevo', linea_numero: num });
    } else if (vieja.tiene_tv && !nueva.tiene_tv) {
      cambios.push({ tipo: 'tv_perdido', linea_numero: num });
    }
  }

  // Detectar cambio de estado global (cliente → no_cliente o viceversa)
  const viejoEstado = datosViejos?.estado;
  const nuevoEstado = datosNuevos?.estado;
  if (viejoEstado === 'no_cliente' && nuevoEstado === 'completado') {
    cambios.push({ tipo: 'cliente_recuperado', valor_nuevo: 'El cliente volvió a Orange' });
  } else if ((viejoEstado === 'completado' || !viejoEstado) && nuevoEstado === 'no_cliente') {
    cambios.push({ tipo: 'cliente_perdido', valor_nuevo: 'El cliente se fue de Orange' });
  }

  // Cambio de paquete
  if (datosViejos?.header?.paquete && datosNuevos?.header?.paquete &&
      datosViejos.header.paquete !== datosNuevos.header.paquete) {
    cambios.push({ tipo: 'paquete_cambio', valor_anterior: datosViejos.header.paquete, valor_nuevo: datosNuevos.header.paquete });
  }

  return cambios;
}

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-bot-api-key');
  if (apiKey !== BOT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id_cliente, proyecto_id, datos, estado } = body;

    if (!id_cliente || !datos) {
      return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
    }

    const pid = proyecto_id || 1;

    // Leer datos anteriores para comparar
    const { rows: [prev] } = await pool.query(
      `SELECT datos FROM clientes_proyectos WHERE id_cliente = $1 AND proyecto_id = $2`,
      [id_cliente, pid]
    );
    const datosViejos = prev?.datos || null;

    // Guardar datos nuevos
    await pool.query(
      `INSERT INTO clientes_proyectos (id_cliente, proyecto_id, datos, ultima_extraccion)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (id_cliente, proyecto_id)
       DO UPDATE SET datos = $3, ultima_extraccion = now(), updated_at = now()`,
      [id_cliente, pid, JSON.stringify(datos)]
    );

    // Actualizar nombre en clientes
    const nombre = datos?.header?.nombre;
    if (nombre && nombre !== 'N/A' && nombre !== 'NO ES CLIENTE') {
      await pool.query(
        `UPDATE clientes SET nombre_razon_social = $1, updated_at = now()
         WHERE id_cliente = $2 AND (nombre_razon_social IS NULL OR nombre_razon_social = '')`,
        [nombre, id_cliente]
      );
    }

    // Detectar cambios vs análisis anterior
    if (datosViejos && datosViejos.estado !== 'pendiente') {
      const cambios = detectarCambios(datosViejos, datos);
      for (const c of cambios) {
        await pool.query(
          `INSERT INTO detecciones (id_cliente, proyecto_id, tipo, linea_numero, valor_anterior, valor_nuevo, datos_extra)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id_cliente, pid, c.tipo, c.linea_numero || null, c.valor_anterior || null, c.valor_nuevo || null, JSON.stringify(c.datos_extra || {})]
        );
      }
    }

    // Registrar en historial
    await pool.query(
      `INSERT INTO historial (id_cliente, tipo, proyecto_id, descripcion, datos)
       VALUES ($1, 'extraccion', $2, $3, $4)`,
      [id_cliente, pid,
       `Bot extrajo ${datos.lineas?.length || 0} lineas`,
       JSON.stringify({ estado: estado || 'completado', cima: datos.cima_global || false, lineas_count: datos.lineas?.length || 0 })]
    );

    return NextResponse.json({ success: true, id_cliente });
  } catch (error: any) {
    console.error('[bot-sync] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
