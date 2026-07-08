"use server";

import { revalidatePath } from "next/cache";
import { requirePortal } from "@/lib/portal/session";
import { hasFeature } from "@/lib/features";
import { yaOpinoHoy, crearOpinion } from "@/lib/queries/opiniones.queries";

/**
 * Registra la opinión del miembro desde el portal (máx. 1 por día). Devuelve
 * si fue de 5 estrellas para ofrecer la reseña en Google (Bloque 3).
 */
export async function enviarOpinionPortalAction(
  slug: string,
  calificacion: number,
  comentario: string
): Promise<{ ok: boolean; error?: string; cincoEstrellas?: boolean }> {
  const { gym, session } = await requirePortal(slug);
  if (!hasFeature(gym.plan, "opiniones")) {
    return { ok: false, error: "No disponible." };
  }

  const cal = Math.round(Number(calificacion));
  if (!(cal >= 1 && cal <= 5)) {
    return { ok: false, error: "Selecciona de 1 a 5 estrellas." };
  }

  if (await yaOpinoHoy(gym.id, session.miembroId)) {
    return { ok: false, error: "Ya dejaste tu opinión hoy. ¡Gracias!" };
  }

  const r = await crearOpinion({
    tenantId: gym.id,
    miembroId: session.miembroId,
    calificacion: cal,
    comentario,
    origen: "portal",
  });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/portal/${slug}`);
  return { ok: true, cincoEstrellas: cal === 5 };
}
