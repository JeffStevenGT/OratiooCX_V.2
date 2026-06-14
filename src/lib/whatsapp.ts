/**
 * lib/whatsapp.ts — Cliente Meta Cloud API para WhatsApp
 * ========================================================
 * Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

const WA_API = 'https://graph.facebook.com/v22.0';
const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID || '';
const WA_TOKEN = process.env.WA_ACCESS_TOKEN || '';
const WA_VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || 'oratioo_wa_webhook';

export function isConfigured(): boolean {
  return !!(WA_PHONE_ID && WA_TOKEN);
}

/** Enviar mensaje de texto simple */
export async function sendText(to: string, text: string) {
  if (!isConfigured()) throw new Error('WhatsApp no configurado');
  return fetch(`${WA_API}/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text },
    }),
  }).then(r => r.json());
}

/** Enviar plantilla (template) */
export async function sendTemplate(to: string, templateName: string, params: string[] = [], language = 'es') {
  if (!isConfigured()) throw new Error('WhatsApp no configurado');
  const components = params.length > 0 ? [{
    type: 'body',
    parameters: params.map(p => ({ type: 'text', text: p })),
  }] : [];

  return fetch(`${WA_API}/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components,
      },
    }),
  }).then(r => r.json());
}

/** Verificar token del webhook (Meta lo llama al configurar) */
export function verifyWebhook(mode: string, token: string, challenge: string): string | null {
  if (mode === 'subscribe' && token === WA_VERIFY_TOKEN) {
    return challenge;
  }
  return null;
}

/** Parsear mensaje entrante del webhook */
export interface WaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'button' | 'interactive';
  text?: string;
}

export function parseIncoming(body: any): WaMessage[] {
  const messages: WaMessage[] = [];
  try {
    for (const entry of body?.entry || []) {
      for (const change of entry?.changes || []) {
        for (const msg of change?.value?.messages || []) {
          messages.push({
            from: msg.from,
            id: msg.id,
            timestamp: msg.timestamp,
            type: msg.type,
            text: msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.id || '',
          });
        }
      }
    }
  } catch { /* */ }
  return messages;
}
