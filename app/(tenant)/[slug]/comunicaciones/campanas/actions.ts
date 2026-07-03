"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { createClient } from "@/lib/supabase/server";
import {
  getDestinatariosByAudiencia,
  createCampana,
} from "@/lib/queries/campanas.queries";
import { campanaInputSchema } from "@/lib/validations/campanas.schema";

/**
 * Registra una campaña como enviada. El total de destinatarios se recalcula
 * server-side (fuente de verdad) para no confiar en un conteo del cliente.
 */
export async function enviarCampanaAction(
  input: unknown
): Promise<{ ok: boolean; error?: string; total?: number }> {
  const tenant = await getTenant();
  if (!hasFeature(tenant.plan, "campanas")) {
    return { ok: false, error: "Tu plan no incluye Campañas." };
  }

  const parsed = campanaInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida." };

  const { destinatarios } = await getDestinatariosByAudiencia(
    tenant.id,
    parsed.data.audiencia
  );

  const r = await createCampana(
    tenant.id,
    parsed.data,
    destinatarios.length,
    user.id
  );
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/comunicaciones/campanas`);
  return { ok: true, total: destinatarios.length };
}
