"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { aceptarTerminos } from "@/lib/queries/gyms.queries";

/**
 * Registra la aceptación de Términos del tenant actual. El tenant se resuelve
 * server-side vía getTenant() (no se confía en un id del cliente).
 */
export async function aceptarTerminosAction(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const tenant = await getTenant();
  const res = await aceptarTerminos(tenant.id);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath(`/${tenant.slug}`, "layout");
  return { ok: true };
}
