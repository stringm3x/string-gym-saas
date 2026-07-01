import { createClient } from "@/lib/supabase/server";
import type { NotificacionTipo } from "@/lib/utils/notifications";

export interface Notificacion {
  id: string;
  tipo: NotificacionTipo;
  titulo: string;
  mensaje: string | null;
  leida: boolean;
  accion_url: string | null;
  created_at: string;
}

const COLS = "id, tipo, titulo, mensaje, leida, accion_url, created_at";

/**
 * Últimas notificaciones del tenant (más recientes primero). RLS ya aísla por
 * gym; el filtro explícito por tenant_id es defensa en profundidad.
 */
export async function getNotificaciones(
  tenantId: string,
  limit = 10
): Promise<Notificacion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gym_notifications")
    .select(COLS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Notificacion[];
}

/** Cuenta de notificaciones no leídas del tenant (para el badge). */
export async function countNotificacionesNoLeidas(
  tenantId: string
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("gym_notifications")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("leida", false);
  return count ?? 0;
}
