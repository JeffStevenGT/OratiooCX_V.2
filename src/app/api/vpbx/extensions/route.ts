/**
 * GET /api/vpbx/extensions — Extensiones VPBX + asignación de usuarios
 * Combina datos de la VPBX con la tabla usuarios (extension_vpbx)
 * Cache Redis: 15s TTL (los datos de extensión no cambian frecuentemente)
 * Roles: supervisor, jefe_area, desarrollador, it
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-roles';
import { listExtensions } from '@/lib/vpbx';
import { cacheGet, cacheDeletePattern } from '@/lib/redis';
import pool from '@/lib/db';

export async function GET() {
  try {
    const session = await requireAuth();
    const userRole = (session.user as any).role || 'asesor';
    
    if (!['supervisor', 'jefe_area', 'desarrollador', 'it'].includes(userRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Cache 15 segundos — las extensiones y usuarios no cambian a cada momento
    const result = await cacheGet('vpbx:extensions', async () => {
      // 1. Obtener extensiones de la VPBX
      const extensions = await listExtensions();

      // 2. Obtener usuarios con extension_vpbx asignada
      const { rows: usuarios } = await pool.query(
        `SELECT id, email, nombre, rol, equipo, extension_vpbx, activo 
         FROM usuarios 
         WHERE extension_vpbx IS NOT NULL AND activo = true`
      );

      // 3. Mapa: extension → usuario asignado
      const extUsuarioMap: Record<string, typeof usuarios[0]> = {};
      for (const u of usuarios) {
        if (u.extension_vpbx) extUsuarioMap[u.extension_vpbx] = u;
      }

      // 4. Fusionar datos
      return (Array.isArray(extensions) ? extensions : []).map((ext: any) => {
        const extensionId = ext.id || ext.extension || ext.username || ext.number || '';
        const assignedUser = extUsuarioMap[String(extensionId)] || null;
        return {
          ...ext,
          assigned_user: assignedUser
            ? {
                id: assignedUser.id,
                nombre: assignedUser.nombre,
                email: assignedUser.email,
                rol: assignedUser.rol,
                equipo: assignedUser.equipo,
              }
            : null,
        };
      });
    }, 15);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    console.error('[api/vpbx/extensions]', error.message);
    return NextResponse.json({ 
      error: error.message.includes('VPBX_API_KEY') 
        ? 'VPBX no configurada (falta VPBX_API_KEY)' 
        : 'Error al obtener extensiones de la VPBX',
      extensions: [],
      vpbxReady: false
    });
  }
}

/**
 * PUT /api/vpbx/extensions — Invalidar cache tras asignar/desasignar
 * El frontend llama a este endpoint después de PATCH /api/usuarios
 * para forzar que la siguiente GET traiga datos frescos.
 */
export async function PUT() {
  try {
    const session = await requireAuth();
    const userRole = (session.user as any).role || 'asesor';
    
    if (!['supervisor', 'jefe_area', 'desarrollador', 'it'].includes(userRole)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await cacheDeletePattern('vpbx:extensions');
    return NextResponse.json({ success: true, cache: 'invalidado' });
  } catch (error: any) {
    if (error.message === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
