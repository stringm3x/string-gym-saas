import type { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiKey, type ApiContext } from "@/lib/api/auth";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { apiError } from "@/lib/api/response";
import { logApiRequest, clientIp } from "@/lib/api/log";
import { apiGetGymPublic, type GymPublic } from "@/lib/api/data";

type GuardResult =
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      ctx: ApiContext;
      ip: string | null;
      /** Registra la request en el log con el status final. */
      log: (statusCode: number) => void;
    };

/**
 * Auth por API key + rate limit + helper de log. Úsalo al inicio de cada
 * endpoint autenticado:
 *
 *   const g = await apiGuard(request, slug, "/planes", "GET");
 *   if (!g.ok) return g.response;
 *   ...usar g.ctx.tenantId...
 *   g.log(200);
 */
export async function apiGuard(
  request: NextRequest,
  slug: string,
  endpoint: string,
  method: string
): Promise<GuardResult> {
  const auth = await authenticateApiKey(request, slug);
  if (!auth.ok) {
    return {
      ok: false,
      response: apiError(auth.code, auth.message, auth.status, slug),
    };
  }

  const ip = clientIp(request);
  const tenantId = auth.ctx.tenantId;
  const log = (statusCode: number) =>
    logApiRequest({ tenantId, endpoint, method, statusCode, ip });

  const { allowed } = checkRateLimit(auth.ctx.apiKey);
  if (!allowed) {
    log(429);
    return {
      ok: false,
      response: apiError(
        "RATE_LIMITED",
        "Límite de 100 requests por minuto excedido.",
        429,
        slug
      ),
    };
  }

  return { ok: true, ctx: auth.ctx, ip, log };
}

type PublicGuardResult =
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      gym: GymPublic;
      ip: string | null;
      log: (statusCode: number) => void;
    };

/**
 * Guard para endpoints PÚBLICOS de lectura (planes, clases, info): no requieren
 * API key. Resuelve el gym por slug (404 si no existe), rate-limita por slug y
 * deja listo el helper de log.
 */
export async function apiPublicGuard(
  request: NextRequest,
  slug: string,
  endpoint: string,
  method: string
): Promise<PublicGuardResult> {
  const admin = createAdminClient();
  const gym = await apiGetGymPublic(slug, admin);
  if (!gym) {
    return {
      ok: false,
      response: apiError("NOT_FOUND", "Gym no encontrado.", 404, slug),
    };
  }

  const ip = clientIp(request);
  const log = (statusCode: number) =>
    logApiRequest({ tenantId: gym.id, endpoint, method, statusCode, ip });

  // Sin API key: limitamos por slug.
  const { allowed } = checkRateLimit(`pub:${slug}`);
  if (!allowed) {
    log(429);
    return {
      ok: false,
      response: apiError(
        "RATE_LIMITED",
        "Límite de 100 requests por minuto excedido.",
        429,
        slug
      ),
    };
  }

  return { ok: true, gym, ip, log };
}
