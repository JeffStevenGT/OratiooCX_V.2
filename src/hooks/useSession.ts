/**
 * hooks/useSession.ts — Current user session
 */
'use client';

import { useAPI, apiUrl } from './useSWR';

interface SessionUser { id: number; name?: string; email?: string; role?: string; }

export function useSession() {
  const { data, isLoading } = useAPI<{ user?: SessionUser }>(apiUrl('/api/auth/session'));
  return {
    user: data?.user || null,
    role: data?.user?.role || 'asesor',
    userId: data?.user?.id || 0,
    isLoading,
  };
}
