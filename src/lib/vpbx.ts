/**
 * lib/vpbx.ts — Cliente VPBX
 * ============================
 * Documentación: https://doc.vpbx.me/admin/
 * API Base: https://vpbx.me/api
 */

const VPBX_API = process.env.VPBX_API_URL || 'https://vpbx.me/api';
const VPBX_KEY = process.env.VPBX_API_KEY || '';

async function vpbxFetch(path: string, options: RequestInit = {}) {
  if (!VPBX_KEY) throw new Error('VPBX_API_KEY no configurada');
  const res = await fetch(`${VPBX_API}${path}`, {
    ...options,
    headers: {
      'X-Api-Key': VPBX_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error');
    throw new Error(`VPBX ${res.status}: ${err}`);
  }
  return res.json();
}

/** Click2Call: suena en extensión, llama al cliente */
export async function originateCall(from: string, to: string, timeout: number = 30) {
  return vpbxFetch(`/originatecall/${from}/${to}?timeout=${timeout}`);
}

/** Click2Call inverso: suena en número externo, conecta a destino interno */
export async function originateExternal(from: string, to: string) {
  return vpbxFetch(`/c2cexternal/${from}/${to}`);
}

/** Obtener CDR de una llamada */
export async function getCallDetail(callId: string) {
  return vpbxFetch(`/cdr/${callId}`);
}

/** Listar llamadas con filtros */
export async function listCalls(filters: {
  from?: number;
  to?: number;
  src?: string;
  dst?: string;
  start?: number;
  stop?: number;
}) {
  return vpbxFetch('/cdr', {
    method: 'POST',
    body: JSON.stringify(filters),
  });
}

/** Contar llamadas (para paginación) */
export async function countCalls(filters: Record<string, any>) {
  return vpbxFetch('/cdrcount', {
    method: 'POST',
    body: JSON.stringify(filters),
  });
}

/** Listar agentes y su estado */
export async function listAgents() {
  return vpbxFetch('/agent');
}

/** Obtener historial de cambios de estado de agentes */
export async function getAgentStatusChanges(filters: {
  start: number;
  end: number;
  statuses?: string[];
  agents?: string[];
  limit?: number;
}) {
  return vpbxFetch('/agent/statuscount', {
    method: 'POST',
    body: JSON.stringify(filters),
  });
}

/** Obtener URL de grabación (se necesita API key con permisos de grabación) */
export async function getRecordingUrl(callId: string): Promise<string | null> {
  // Las grabaciones requieren un endpoint separado con streaming
  return `${VPBX_API}/recording/${callId}`;
}

/** Relacionar el callId del click2call con el cdr real */
export async function getCdrFromC2c(callId: string) {
  return vpbxFetch(`/cdrc2c/${callId}`);
}

// ── Helpers para el CRM ──

/** Formatear causa de colgado para mostrar en UI */
export function formatHangupCause(cause: string): string {
  const map: Record<string, string> = {
    NORMAL_CLEARING: 'Normal',
    ORIGINATOR_CANCEL: 'Cancelado por origen',
    NO_ANSWER: 'No contestó',
    BUSY: 'Ocupado',
    CONGESTION: 'Error de red',
    CALL_REJECTED: 'Rechazada',
  };
  return map[cause] || cause;
}

/** Decidir si una llamada fue efectiva (hubo conversación) */
export function wasCallEffective(billsec: number): boolean {
  return billsec > 5; // Más de 5 segundos de conversación real
}
