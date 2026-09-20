"use server";

import { revalidatePath } from "next/cache";
import { panelAction } from "@/lib/authz";
import { aceptarTerminos } from "@/lib/queries/gyms.queries";

/**
 * Registra la aceptación de Términos del tenant actual. El tenant se resuelve
 * server-side vía el contexto de la acción (no se confía en un id del cliente).
 */
export const aceptarTerminosAction = panelAction(
  "panel.aceptar_terminos",
  {},
  async (tenant): Promise<{ ok: boolean; error?: string }> => {
    const res = await aceptarTerminos(tenant.id);
    if (!res.ok) return { ok: false, error: res.error };
    revalidatePath(`/${tenant.slug}`, "layout");
    return { ok: true };
  }
);
