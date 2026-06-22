/**
 * lib/ddi-router.ts — Selección de DDI por provincia para llamadas salientes
 * ==========================================================================
 * Dado el número que se marca, decide qué DDI (outboundId de VPBX) presentar,
 * para que el cliente vea un número de su misma provincia.
 *
 * Cascada de decisión (de más fiable a menos):
 *   1. El número es FIJO (8/9...) → provincia por su prefijo (no necesita CP).
 *   2. El número es MÓVIL (6/7)  → buscamos el cliente en BD y usamos el CP
 *      de su dirección (los 2 primeros dígitos del CP = código de provincia).
 *   3. No se puede determinar    → null → VPBX usa su DDI por defecto (igual que hoy).
 *
 * El UUID de la Regla de salida (outbound_id) lo configura el admin en el panel
 * de VPBX y se guarda en la tabla `ddis`. Si una provincia no tiene outbound_id
 * cargado, se cae al DDI por defecto.
 */

import pool from '@/lib/db';

export interface DDIElegido {
  ddi: string;
  outboundId: string;
  provincia: string;
  codigoProv: string;
  motivo: 'prefijo_fijo' | 'cp_cliente';
}

/** Deja el número en 9 dígitos nacionales (quita +34, 34, espacios, guiones). */
export function normalizarNumero(raw: string): string {
  let n = (raw || '').replace(/[\s\-().]/g, '');
  n = n.replace(/^\+?34/, '');
  return n;
}

/** Extrae el código de provincia (2 dígitos) de un código postal dentro de un texto libre. */
function codigoProvDesdeCP(direccion: string | null): string | null {
  if (!direccion) return null;
  const m = direccion.match(/\b(\d{5})\b/); // un CP español = 5 dígitos
  if (!m) return null;
  const cp = m[1];
  const cod = cp.slice(0, 2);
  return cod >= '01' && cod <= '52' ? cod : null;
}

/** Para un fijo, busca en la tabla ddis qué provincia tiene ese prefijo. */
async function codigoProvDesdePrefijoFijo(num: string): Promise<string | null> {
  if (!/^[89]/.test(num)) return null; // sólo fijos
  const pref3 = num.slice(0, 3);
  const pref2 = num.slice(0, 2);
  // Preferimos coincidencia de 3 dígitos (más específica) antes que la de 2.
  const { rows } = await pool.query<{ codigo_prov: string; matchlen: number }>(
    `SELECT codigo_prov,
            CASE WHEN prefijos @> ARRAY[$1]::text[] THEN 3 ELSE 2 END AS matchlen
       FROM ddis
      WHERE prefijos && ARRAY[$1,$2]::text[]
        AND codigo_prov IS NOT NULL
      ORDER BY matchlen DESC
      LIMIT 1`,
    [pref3, pref2],
  );
  return rows[0]?.codigo_prov ?? null;
}

/** Busca la dirección del cliente en BD por uno de sus números de línea. */
async function direccionPorNumero(num: string): Promise<string | null> {
  const { rows } = await pool.query<{ direccion: string }>(
    `SELECT datos->'header'->>'direccion' AS direccion
       FROM clientes_proyectos
      WHERE datos->'lineas' @> $1::jsonb
      LIMIT 1`,
    [JSON.stringify([{ numero: num }])],
  );
  return rows[0]?.direccion ?? null;
}

/** Elige un DDI activo (con outbound_id) de la provincia, rotando para no quemar siempre el mismo. */
async function elegirDDIActivo(
  codigoProv: string,
): Promise<{ ddi: string; outbound_id: string; provincia: string } | null> {
  const { rows } = await pool.query<{ ddi: string; outbound_id: string; provincia: string }>(
    `SELECT ddi, outbound_id, provincia
       FROM ddis
      WHERE codigo_prov = $1
        AND estado = 'activo'
        AND outbound_id IS NOT NULL
      ORDER BY fecha_ultimo_uso ASC NULLS FIRST, random()
      LIMIT 1`,
    [codigoProv],
  );
  return rows[0] ?? null;
}

/**
 * Resuelve el DDI a presentar para una llamada saliente.
 * @param destino  número que se marca (en cualquier formato)
 * @returns DDIElegido o null si no se puede determinar (→ DDI por defecto de VPBX)
 */
export async function resolverOutboundDDI(destino: string): Promise<DDIElegido | null> {
  const num = normalizarNumero(destino);
  if (!num) return null;

  // 1) Fijo → provincia por prefijo
  let codigoProv = await codigoProvDesdePrefijoFijo(num);
  let motivo: DDIElegido['motivo'] = 'prefijo_fijo';

  // 2) Móvil o fijo no resuelto → CP del cliente en BD
  if (!codigoProv) {
    const direccion = await direccionPorNumero(num);
    codigoProv = codigoProvDesdeCP(direccion);
    motivo = 'cp_cliente';
  }

  if (!codigoProv) return null;

  const elegido = await elegirDDIActivo(codigoProv);
  if (!elegido) return null;

  // Marca de uso para la rotación (best-effort, no bloquea la llamada)
  pool
    .query(`UPDATE ddis SET fecha_ultimo_uso = CURRENT_DATE WHERE ddi = $1`, [elegido.ddi])
    .catch(() => {});

  return {
    ddi: elegido.ddi,
    outboundId: elegido.outbound_id,
    provincia: elegido.provincia,
    codigoProv,
    motivo,
  };
}
