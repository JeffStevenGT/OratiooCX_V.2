/**
 * POST /api/anuncios/cumpleanos-auto — Generar anuncio de cumpleaños automático
 * Llamado por cron job diario (ej: 00:05 AM hora servidor)
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: Request) {
  try {
    // Solo llamado interno (cron)
    const hoy = new Date();
    const mes = hoy.getMonth() + 1;
    const dia = hoy.getDate();

    // Buscar usuarios que cumplan hoy
    const { rows: cumpleaneros } = await pool.query(
      `SELECT id, nombre, equipo FROM usuarios
       WHERE activo = true
         AND fecha_nacimiento IS NOT NULL
         AND EXTRACT(MONTH FROM fecha_nacimiento) = $1
         AND EXTRACT(DAY FROM fecha_nacimiento) = $2`,
      [mes, dia]
    );

    if (cumpleaneros.length === 0) {
      return NextResponse.json({ success: true, cumpleaneros: 0 });
    }

    const nombres = cumpleaneros.map((c: any) => c.nombre).join(', ');
    const titulo = `🎂 ¡Feliz cumpleaños ${nombres}!`;
    const mensaje = cumpleaneros.length === 1
      ? `Hoy celebramos el cumpleaños de ${nombres}. ¡Dale una sorpresa cuando lo veas! 🎉`
      : `Hoy celebramos los cumpleaños de ${nombres}. ¡Felicítalos cuando los veas! 🎉`;

    // Publicar anuncio para el proyecto Orange (id=1)
    await pool.query(
      `INSERT INTO anuncios (proyecto_id, titulo, mensaje, tipo, roles_visibles, creado_por)
       VALUES (1, $1, $2, 'cumpleanos', ARRAY['asesor','supervisor','jefe_area','back_office','auditor_calidad','it','desarrollador'],
         (SELECT id FROM usuarios WHERE rol = 'desarrollador' AND activo = true LIMIT 1))`,
      [titulo, mensaje]
    );

    return NextResponse.json({ success: true, cumpleaneros: cumpleaneros.length, nombres });
  } catch (e: any) {
    console.error('[cumpleanos-auto]', e.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
