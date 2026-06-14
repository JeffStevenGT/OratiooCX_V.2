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

/** Contar cambios de estado de agentes */
export async function countAgentStatusChanges(filters: {
  start: number;
  end: number;
  statuses?: string[];
  agents?: string[];
}) {
  return vpbxFetch('/agent/statuscount', {
    method: 'POST',
    body: JSON.stringify(filters),
  });
}

/** Obtener historial de cambios de estado de agentes */
export async function getAgentStatusChanges(filters: {
  start: number;
  end: number;
  statuses?: string[];
  agents?: string[];
  offset?: number;
  limit?: number;
}) {
  return vpbxFetch('/agent/status', {
    method: 'POST',
    body: JSON.stringify({ ...filters, offset: filters.offset ?? 0, limit: filters.limit ?? 50 }),
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

/** Actualizar variables personalizadas en un CDR (var1-var5, máx 255 chars c/u) */
export async function updateCallVars(callId: string, vars: {
  var1?: string;
  var2?: string;
  var3?: string;
  var4?: string;
  var5?: string;
}) {
  return vpbxFetch(`/cdr/${callId}/updatevars`, {
    method: 'POST',
    body: JSON.stringify(vars),
  });
}

/** Obtener tiempo medio de espera de una cola */
export async function getQueueWaitTime(queueNumber: number) {
  return vpbxFetch(`/queue/${queueNumber}/waittime`);
}

/** Obtener llamadas en cola en vivo */
export async function getQueueState(queueNumber: number) {
  return vpbxFetch(`/queue/${queueNumber}/state`);
}

/** Listar todas las extensiones */
export async function listExtensions() {
  return vpbxFetch('/extension');
}

/** Obtener datos de una extensión */
export async function getExtension(extensionId: string) {
  return vpbxFetch(`/extension/${extensionId}`);
}

/** Buscar id de extensión por username */
export async function findExtensionByUsername(username: string) {
  return vpbxFetch(`/extension/findbyusername/${username}`);
}

/** Actualizar outboundId de una extensión */
export async function updateExtension(extensionId: string, outboundId: string) {
  return vpbxFetch(`/extension/${extensionId}`, {
    method: 'POST',
    body: JSON.stringify({ outboundId }),
  });
}

/** Obtener voces TTS disponibles (Amazon Polly) */
export async function getVoices() {
  return vpbxFetch('/voiceengine');
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
