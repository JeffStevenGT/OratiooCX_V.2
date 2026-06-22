/**
 * app/api/clientes/route.ts — Clientes con datos del bot (Orange)
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await pool.query(`
      WITH proyecto AS (SELECT id AS pid FROM proyectos WHERE nombre = 'orange')
      SELECT
        c.id_cliente,
        c.tipo_documento,
        c.numero_documento,
        c.nombre_razon_social,
        c.tipo_persona,
        c.whatsapp_opt_in,
        c.whatsapp_numero,
        c.alertas_fidelizacion,
        cp.datos,
        cp.ultima_extraccion,
        cp.updated_at
      FROM clientes c
      CROSS JOIN proyecto p
      JOIN clientes_proyectos cp ON c.id_cliente = cp.id_cliente
      WHERE cp.proyecto_id = p.pid
        AND cp.datos->>'estado' IN ('completado', 'no_cliente')
      ORDER BY cp.ultima_extraccion DESC NULLS LAST
      LIMIT 500
    `);

    // Transformar para el frontend
    const clientes = rows.map((r: any) => {
      const datos = r.datos || {};
      const header = datos.header || {};
      const lineas = datos.lineas || [];

      // Nombre visible: usar header.nombre (contiene la casuistica real)
      const nombre = datos.estado === 'no_cliente'
        ? (header.nombre || 'NO ES CLIENTE')
        : (header.nombre || r.nombre_razon_social || 'N/A');

      // CIMA global
      const cima = datos.cima_global ? 'SI' : 'NO';

      // Línea principal (primera línea con número)
      const primera = lineas[0] || {};
      const linea_principal = primera.numero || 'N/A';

      // Paquete
      const paquete = header.paquete || 'N/A';

      // Renove Mixto — prioridad de variantes entre todas las líneas
      const PRIORIDAD_RENOVE = [
        'Renove mixto al mejor precio con máximo descuento',
        'Renove mixto al mejor precio con descuento',
        'Renove mixto al mejor precio',
        'Renove mixto',
        'Renove Multidispositivo',
      ];
      const tiene_renove = lineas.some((l: any) => l.tiene_renove);
      let mejor_variante = 'N/A';
      if (tiene_renove) {
        for (const p of PRIORIDAD_RENOVE) {
          const match = lineas.find((l: any) => l.variante_renove === p);
          if (match) { mejor_variante = p; break; }
        }
        if (mejor_variante === 'N/A') {
          const otra = lineas.find((l: any) => l.variante_renove && l.variante_renove !== 'N/A');
          if (otra) mejor_variante = otra.variante_renove;
        }
      }

      // Fecha y hora de extracción
      const fecha = r.ultima_extraccion
        ? new Date(r.ultima_extraccion).toISOString().split('T')[0]
        : '';
      const hora = r.ultima_extraccion
        ? new Date(r.ultima_extraccion).toISOString().split('T')[1]?.slice(0, 8) || ''
        : '';

      return {
        id_cliente: r.id_cliente,
        dni: r.numero_documento,
        tipo_documento: r.tipo_documento,
        nombre,
        tipo_persona: r.tipo_persona || 'natural',
        whatsapp_opt_in: r.whatsapp_opt_in || false,
        whatsapp_numero: r.whatsapp_numero || '',
        alertas_fidelizacion: r.alertas_fidelizacion || false,
        linea_principal,
        paquete,
        cima,
        tiene_renove: tiene_renove ? 'SI' : 'NO',
        renove_variante: mejor_variante,
        fecha,
        hora,
        estado: datos.estado || 'pendiente',
        // Datos completos para el desplegable
        lineas,
        header,
        cima_global: datos.cima_global || false,
      };
    });

    return NextResponse.json(clientes);
  } catch (error: any) {
    console.error('[clientes] Error:', error.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
