import { createAdminClient } from "@/lib/supabase/admin";

export type NotificacionTipo =
  | "vencimiento"
  | "pago"
  | "prospecto"
  | "sistema"
  | "clase";

/**
 * Crea una notificación in-app para un gym (Fase 7.3). Fire-and-forget: nunca
 * lanza — si el insert falla solo loguea, para no romper el flujo que la
 * dispara (un pago, un prospecto, etc.). Usa service-role porque muchos
 * disparadores corren sin sesión (webhooks, API pública).
 *
 * `accionUrl` es una ruta RELATIVA al tenant (sin slug), p. ej. "caja" o
 * "prospectos"; el dropdown la resuelve a `/{slug}/{accionUrl}`.
 */
export async function createNotification(
  tenantId: string,
  tipo: NotificacionTipo,
  titulo: string,
  mensaje?: string,
  accionUrl?: string
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("gym_notifications").insert({
      tenant_id: tenantId,
      tipo,
      titulo,
      mensaje: mensaje ?? null,
      accion_url: accionUrl ?? null,
    });
    if (error) {
      console.error("[notifications] insert falló:", error.message);
    }
  } catch (e) {
    console.error("[notifications] error inesperado:", e);
  }
}
