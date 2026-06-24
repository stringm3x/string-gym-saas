import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** IP del cliente desde los headers de proxy (Vercel/Cloudflare). */
export function clientIp(request: NextRequest): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

/**
 * Registra una request en api_requests_log. Fire-and-forget: no se espera
 * (no bloquea la respuesta) y nunca lanza. No guarda la API key.
 */
export function logApiRequest(params: {
  tenantId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  ip: string | null;
}): void {
  const admin = createAdminClient();
  void admin
    .from("api_requests_log")
    .insert({
      tenant_id: params.tenantId,
      endpoint: params.endpoint,
      method: params.method,
      status_code: params.statusCode,
      ip_address: params.ip,
    })
    .then(
      () => {},
      () => {}
    );
}
