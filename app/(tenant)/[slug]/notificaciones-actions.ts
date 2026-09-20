"use server";

import { revalidatePath } from "next/cache";
import { panelAction } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";

// Inbox compartido del gym: gym_notifications no tiene destinatario, así
// que cualquier staff lo lee y lo marca. Política `usar_panel` = ausencia
// declarada de permiso (lib/authz/politicas.ts).

/** Marca una notificación del tenant actual como leída. */
export const marcarNotificacionLeidaAction = panelAction(
  "notificaciones.marcar_leida",
  { onDenied: () => ({ ok: false }) },
  async (tenant, id: string): Promise<{ ok: boolean }> => {
    const supabase = await createClient();
    await supabase
      .from("gym_notifications")
      .update({ leida: true })
      .eq("id", id)
      .eq("tenant_id", tenant.id);
    revalidatePath(`/${tenant.slug}`, "layout");
    return { ok: true };
  }
);

/** Marca todas las notificaciones no leídas del tenant como leídas. */
export const marcarTodasLeidasAction = panelAction(
  "notificaciones.marcar_todas",
  { onDenied: () => ({ ok: false }) },
  async (tenant): Promise<{ ok: boolean }> => {
    const supabase = await createClient();
    await supabase
      .from("gym_notifications")
      .update({ leida: true })
      .eq("tenant_id", tenant.id)
      .eq("leida", false);
    revalidatePath(`/${tenant.slug}`, "layout");
    return { ok: true };
  }
);
