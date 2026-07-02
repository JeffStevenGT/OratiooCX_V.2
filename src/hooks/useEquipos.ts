/**
 * hooks/useEquipos.ts — Shared equipos list, loaded once per session.
 */
'use client';

import { useAPI, apiUrl } from './useSWR';

interface UsuarioBase { id: number; nombre: string; equipo?: string; }

export function useEquipos() {
  const { data, isLoading } = useAPI<UsuarioBase[]>(apiUrl('/api/usuarios', { rol: 'asesor' }));
  const equipos = data
    ? Array.from(new Set(data.map(u => u.equipo).filter(Boolean))) as string[]
    : [];
  return { equipos, isLoading };
}
