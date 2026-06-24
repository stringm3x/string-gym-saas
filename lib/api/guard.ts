import type { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, type ApiContext } from "@/lib/api/auth";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { apiError } from "@/lib/api/response";
import { logApiRequest, clientIp } from "@/lib/api/log";

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
