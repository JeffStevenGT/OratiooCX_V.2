/**
 * lib/redis.ts — Cliente Redis
 * =============================
 * Usa @upstash/redis (ya instalado) que funciona con:
 * - Redis local (redis://localhost:6379)
 * - Upstash Redis serverless (https://*.upstash.io)
 * - Redis en VPS via Docker
 *
 * Si REDIS_URL no está configurada, las funciones operan en
 * modo degradado: rate limiting en memoria, sin cache, sin colas.
 *
 * Funciones:
 *   - Rate limiting (Click2Call, APIs)
 *   - Cola de webhooks VPBX (procesamiento asíncrono)
 *   - Cache con TTL (agentes, extensiones, config)
 *   - Pub/Sub para eventos en tiempo real
 */

import { Redis } from '@upstash/redis';

// ── Conexión ──
const REDIS_URL = process.env.REDIS_URL || '';

function getRedis(): Redis | null {
  if (!REDIS_URL) return null;
  try {
    // Upstash Redis: url es la REST API URL, token es opcional (incluido en url típicamente)
    // Para Redis local/self-hosted, usar @upstash/redis con url directa funciona
    return new Redis({
      url: REDIS_URL,
      token: process.env.REDIS_TOKEN || '',
    });
  } catch {
    return null;
  }
}

// Singleton lazy
let _redis: Redis | null | undefined;
function redis(): Redis | null {
  if (_redis === undefined) _redis = getRedis();
  return _redis;
}

// ── Rate Limiting ──

/** Rate limit en memoria (fallback cuando Redis no está disponible) */
const memCounters: Record<string, { count: number; resetAt: number }> = {};

/**
 * Verifica rate limiting.
 * @param key - identificador único (ej: "click2call:101")
 * @param maxRequests - máximo de peticiones permitidas
 * @param windowMs - ventana de tiempo en ms
 * @returns true si la petición está permitida, false si excedió el límite
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number = 5,
  windowMs: number = 1000
): Promise<boolean> {
  const r = redis();
  if (!r) {
    // Fallback en memoria
    const now = Date.now();
    const entry = memCounters[key];
    if (!entry || now > entry.resetAt) {
      memCounters[key] = { count: 1, resetAt: now + windowMs };
      return true;
    }
    if (entry.count >= maxRequests) return false;
    entry.count++;
    return true;
  }

  // Redis: usar MULTI para atomicidad
  const now = Date.now();
  const windowKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;

  const current = await r.incr(windowKey);
  if (current === 1) {
    // Primera petición en esta ventana, poner TTL
    await r.expire(windowKey, Math.ceil(windowMs / 1000) + 1);
  }

  return current <= maxRequests;
}

/** Rate limit simple con debounce (para Click2Call) */
export async function debounceCheck(
  key: string,
  cooldownMs: number = 3000
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const r = redis();
  if (!r) {
    const now = Date.now();
    const last = memCounters[key]?.resetAt || 0;
    if (now - last < cooldownMs) {
      return { allowed: false, retryAfterMs: cooldownMs - (now - last) };
    }
    memCounters[key] = { count: 1, resetAt: now };
    return { allowed: true, retryAfterMs: 0 };
  }

  const debounceKey = `debounce:${key}`;
  const lastCall = await r.get<number>(debounceKey);
  const now = Date.now();

  if (lastCall && now - lastCall < cooldownMs) {
    return { allowed: false, retryAfterMs: cooldownMs - (now - lastCall) };
  }

  await r.set(debounceKey, now, { ex: Math.ceil(cooldownMs / 1000) + 1 });
  return { allowed: true, retryAfterMs: 0 };
}

// ── Cola de Webhooks (FIFO) ──

const WEBHOOK_QUEUE_KEY = 'queue:vpbx:webhooks';

/**
 * Encolar un evento de webhook VPBX para procesamiento asíncrono.
 * Útil cuando llegan eventos en ráfaga (RINGING → ANSWERED → HANGUP en ms).
 */
export async function enqueueWebhook(event: unknown): Promise<void> {
  const r = redis();
  if (!r) return; // Sin Redis, el webhook se procesa síncrono (comportamiento actual)

  await r.rpush(WEBHOOK_QUEUE_KEY, JSON.stringify(event));
  // La cola se procesa en background (ver processWebhookQueue)
}

/** Obtener siguiente evento de la cola (no bloqueante) */
export async function dequeueWebhook(): Promise<unknown | null> {
  const r = redis();
  if (!r) return null;

  const item = await r.lpop<string>(WEBHOOK_QUEUE_KEY);
  if (!item) return null;
  try {
    return JSON.parse(item);
  } catch {
    return null;
  }
}

/** Tamaño de la cola de webhooks */
export async function webhookQueueSize(): Promise<number> {
  const r = redis();
  if (!r) return 0;
  return await r.llen(WEBHOOK_QUEUE_KEY);
}

// ── Cache con TTL ──

/**
 * Obtener del cache. Si no existe, ejecutar factory, guardar y retornar.
 * @param key - clave de cache
 * @param factory - función que genera el valor si no está en cache
 * @param ttlSeconds - tiempo de vida en segundos (default 15)
 */
export async function cacheGet<T>(
  key: string,
  factory: () => Promise<T>,
  ttlSeconds: number = 15
): Promise<T> {
  const r = redis();
  if (!r) return factory(); // Sin Redis, sin cache

  const cacheKey = `cache:${key}`;
  const cached = await r.get<T>(cacheKey);
  if (cached !== null) return cached;

  const value = await factory();
  await r.set(cacheKey, value as any, { ex: ttlSeconds });
  return value;
}

/** Invalidar una clave de cache */
export async function cacheDelete(key: string): Promise<void> {
  const r = redis();
  if (!r) return;
  await r.del(`cache:${key}`);
}

/** Invalidar todas las claves que empiezan con un prefijo */
export async function cacheDeletePattern(pattern: string): Promise<void> {
  const r = redis();
  if (!r) return;

  const keys = await r.keys(`cache:${pattern}*`);
  if (keys.length > 0) {
    await r.del(...keys);
  }
}

// ── Pub/Sub (para eventos en tiempo real) ──

const CHANNEL_PREFIX = 'oratioo:';

/**
 * Publicar un evento a un canal.
 * Ej: publishEvent('new_lead', { asesorId: 5, count: 3 })
 */
export async function publishEvent(
  channel: string,
  data: Record<string, unknown>
): Promise<void> {
  const r = redis();
  if (!r) return;
  await r.publish(`${CHANNEL_PREFIX}${channel}`, JSON.stringify(data));
}

// ── Helpers ──

/** Verificar si Redis está disponible */
export async function isRedisReady(): Promise<boolean> {
  const r = redis();
  if (!r) return false;
  try {
    await r.ping();
    return true;
  } catch {
    return false;
  }
}

/** Health check simple */
export async function redisHealth(): Promise<{
  ready: boolean;
  url: string;
}> {
  return {
    ready: await isRedisReady(),
    url: REDIS_URL ? REDIS_URL.replace(/\/\/.*@/, '//***@') : 'no configurado',
  };
}

/** Config necesaria para activar Redis */
export function redisConfig() {
  return {
    url: REDIS_URL || null,
    token: process.env.REDIS_TOKEN ? '***' : null,
    configured: !!REDIS_URL,
  };
}
