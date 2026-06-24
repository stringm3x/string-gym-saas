/**
 * Rate limiter en memoria: 100 requests / 60s por API key.
 * Sliding window simple con un Map de timestamps.
 *
 * Nota: el estado vive en memoria del proceso. En serverless cada instancia
 * tiene su propio Map, así que el límite es por-instancia (best-effort
 * anti-abuse). Para un límite global exacto haría falta un store compartido
 * (Redis/Upstash) — fuera de alcance de v1.
 */

const WINDOW_MS = 60_000;
const LIMIT = 100;

const buckets = new Map<string, number[]>();

export function checkRateLimit(apiKey: string): {
  allowed: boolean;
  remaining: number;
} {
  const now = Date.now();
  const recientes = (buckets.get(apiKey) ?? []).filter(
    (t) => now - t < WINDOW_MS
  );

  if (recientes.length >= LIMIT) {
    buckets.set(apiKey, recientes);
    return { allowed: false, remaining: 0 };
  }

  recientes.push(now);
  buckets.set(apiKey, recientes);
  return { allowed: true, remaining: LIMIT - recientes.length };
}

export const RATE_LIMIT = LIMIT;
export const RATE_WINDOW_SECONDS = WINDOW_MS / 1000;
