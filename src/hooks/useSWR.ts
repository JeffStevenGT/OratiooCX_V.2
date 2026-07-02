/**
 * hooks/useSWR.ts — Shared SWR fetcher + typed helpers
 * Replaces manual useState+useEffect+fetch across all dashboards.
 */
'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

/** Reusable SWR wrapper with 30s dedup and error suppression */
export function useAPI<T = any>(url: string | null) {
  const { data, error, isLoading, mutate } = useSWR<T>(url, fetcher, {
    dedupingInterval: 30000,        // same URL within 30s = single request
    revalidateOnFocus: false,       // dashboards don't need focus revalidation
    shouldRetryOnError: false,      // errors don't auto-retry (user has "Actualizar" button)
    errorRetryCount: 0,
  });
  return { data, error, isLoading, mutate } as const;
}

/** Pre-built URL builders to keep keys consistent across pages */
export function apiUrl(path: string, params?: Record<string, string>) {
  const url = new URL(path, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  return url.toString();
}
