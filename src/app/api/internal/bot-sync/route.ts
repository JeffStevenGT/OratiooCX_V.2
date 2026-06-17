/**
 * app/api/internal/bot-sync/route.ts — Endpoint Interno para Bots
 * ================================================================
 * Guarda resultados del bot Y detecta cambios vs análisis anterior.
 */

import { NextResponse } from 'next/server';
import pool, { transaction } from '@/lib/db';

const BOT_API_KEY = process.env.BOT_API_KEY;
if (!BOT_API_KEY) {
  throw new Error('Falta BOT_API_KEY en variables de entorno');
}

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

    // ── Transacción: SELECT FOR UPDATE → UPSERT → detecciones → historial ──
    await transaction(async (client) => {
      // Leer datos anteriores con lock (evita race condition entre workers)
      const { rows: [prev] } = await client.query(
        `SELECT datos FROM clientes_proyectos WHERE id_cliente = $1 AND proyecto_id = $2 FOR UPDATE`,
        [id_cliente, pid]
      );
      const datosViejos = prev?.datos || null;

      // Determinar si hay datos reales previos
      const tieneDatosPrevios = datosViejos && (
        (datosViejos.lineas && datosViejos.lineas.length > 0) ||
        (datosViejos.version_extraccion && datosViejos.version_extraccion >= 1)
      );
      const versionAnterior = tieneDatosPrevios
        ? (datosViejos.version_extraccion || 1)
        : 0;
      const esPrimeraExtraccion = !tieneDatosPrevios;

      // Incrementar versión de extracción
      const datosConVersion = {
        ...datos,
        version_extraccion: versionAnterior + 1,
        primera_extraccion_at: esPrimeraExtraccion
          ? new Date().toISOString()
          : (datosViejos?.primera_extraccion_at || new Date().toISOString()),
      };

      // Guardar datos nuevos (UPSERT)
      await client.query(
        `INSERT INTO clientes_proyectos (id_cliente, proyecto_id, datos, ultima_extraccion)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (id_cliente, proyecto_id)
         DO UPDATE SET datos = $3, ultima_extraccion = now(), updated_at = now()`,
        [id_cliente, pid, JSON.stringify(datosConVersion)]
      );

      // Actualizar nombre en clientes
      const nombre = datos?.header?.nombre;
      if (nombre && nombre !== 'N/A' && nombre !== 'NO ES CLIENTE') {
        await client.query(
          `UPDATE clientes SET nombre_razon_social = $1, updated_at = now()
           WHERE id_cliente = $2 AND (nombre_razon_social IS NULL OR nombre_razon_social = '')`,
          [nombre, id_cliente]
        );
      }

      // Detectar cambios vs análisis anterior
      if (!esPrimeraExtraccion && datosViejos) {
        const cambios = detectarCambios(datosViejos, datos);
        if (cambios.length > 0) {
          // INSERT batch: 1 query con múltiples VALUES en vez de N queries
          const values: string[] = [];
          const params: any[] = [];
          let pi = 1;
          for (const c of cambios) {
            values.push(`($${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++}, $${pi++})`);
            params.push(id_cliente, pid, c.tipo, c.linea_numero || null, c.valor_anterior || null, c.valor_nuevo || null, JSON.stringify(c.datos_extra || {}));
          }
          await client.query(
            `INSERT INTO detecciones (id_cliente, proyecto_id, tipo, linea_numero, valor_anterior, valor_nuevo, datos_extra)
             VALUES ${values.join(', ')}`,
            params
          );
        }
      }

      // Registrar en historial
      const descripcion = esPrimeraExtraccion
        ? `Análisis inicial — ${datos.lineas?.length || 0} líneas registradas`
        : `Bot re-analizó: ${datos.lineas?.length || 0} líneas (v${datosConVersion.version_extraccion})`;
      await client.query(
        `INSERT INTO historial (id_cliente, tipo, proyecto_id, descripcion, datos)
         VALUES ($1, 'extraccion', $2, $3, $4)`,
        [id_cliente, pid,
         descripcion,
         JSON.stringify({
           estado: estado || 'completado',
           cima: datos.cima_global || false,
           lineas_count: datos.lineas?.length || 0,
           version_extraccion: datosConVersion.version_extraccion,
           es_primera_extraccion: esPrimeraExtraccion,
         })]
      );
    });

    return NextResponse.json({ success: true, id_cliente });
  } catch (error: any) {
    console.error('[bot-sync] Error:', error.message);
    console.error('[api]', error.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
