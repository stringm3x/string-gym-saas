import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";

/** IP del cliente desde los headers de proxy (Vercel/Cloudflare). */
export function clientIp(request: NextRequest): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

/**
 * Registra una request en api_requests_log. Fire-and-forget a propósito: no
 * se espera (no bloquea la respuesta al cliente de la API) y nunca lanza.
 * No guarda la API key. Sigue sin bloquear si falla — es solo el log de uso
 * que se muestra en Configuración → API — pero antes el fallo se tragaba
 * entero (catch vacío); ahora queda una línea greppable.
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
      // Supabase-js resuelve con { error } en vez de rechazar la promesa
      // ante un error de la query — un `.then(() => {}, ...)` como el que
      // había antes nunca lo veía: solo atrapaba una promesa rechazada
      // (fallo de red), no un insert que la base rechazó.
      ({ error }) => {
        if (error) {
          logError("api.log_request_fallo", {
            tenantId: params.tenantId,
            endpoint: params.endpoint,
            error: error.message,
          });
        }
      },
      (err) => {
        logError("api.log_request_fallo", {
          tenantId: params.tenantId,
          endpoint: params.endpoint,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    );
}
