"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePortal } from "@/lib/portal/session";
import { solicitarCongelacionPortal } from "@/lib/queries/miembro-eventos.queries";

export async function solicitarCongelacionAction(
  slug: string,
  fechaInicio: string,
  fechaFin: string
): Promise<{ ok: boolean; error?: string; aplicada?: boolean }> {
  const { gym, session } = await requirePortal(slug);
  if (!fechaInicio || !fechaFin) {
    return { ok: false, error: "Indica las fechas de la pausa." };
  }

  const admin = createAdminClient();
  const r = await solicitarCongelacionPortal(
    gym.id,
    session.miembroId,
    { fechaInicio, fechaFin },
    admin
  );
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/portal/${slug}`);
  return { ok: true, aplicada: r.aplicada };
}
