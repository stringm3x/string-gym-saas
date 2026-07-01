"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";

/** Marca una notificación del tenant actual como leída. */
export async function marcarNotificacionLeidaAction(
  id: string
): Promise<{ ok: boolean }> {
  const tenant = await getTenant();
  const supabase = await createClient();
  await supabase
    .from("gym_notifications")
    .update({ leida: true })
    .eq("id", id)
    .eq("tenant_id", tenant.id);
  revalidatePath(`/${tenant.slug}`, "layout");
  return { ok: true };
}

/** Marca todas las notificaciones no leídas del tenant como leídas. */
export async function marcarTodasLeidasAction(): Promise<{ ok: boolean }> {
  const tenant = await getTenant();
  const supabase = await createClient();
  await supabase
    .from("gym_notifications")
    .update({ leida: true })
    .eq("tenant_id", tenant.id)
    .eq("leida", false);
  revalidatePath(`/${tenant.slug}`, "layout");
  return { ok: true };
}
