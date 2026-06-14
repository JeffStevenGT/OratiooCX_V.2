/**
 * lib/api-helpers.ts — Helpers para API Routes
 * =============================================
 * fetchWithRetry: intenta una llamada fetch hasta N veces con backoff.
 * apiFetch: wrapper tipado que incluye manejo de errores estándar.
 */

// Reintento con backoff exponencial
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 2,
  baseDelay = 500
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      // Solo reintentar en errores de red o 5xx
      if (!res.ok && res.status >= 500 && i < retries) {
        await delay(baseDelay * Math.pow(2, i));
        continue;
      }
      return res;
    } catch (e: any) {
      if (i === retries) throw e;
      // Error de red (offline, timeout) → reintentar
      await delay(baseDelay * Math.pow(2, i));
    }
  }
  throw new Error('Máximo de reintentos alcanzado');
}

// Wrapper tipado
export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetchWithRetry(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }
  return res.json();
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
