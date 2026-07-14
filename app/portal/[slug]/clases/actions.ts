"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePortal } from "@/lib/portal/session";
import { cancelarReserva } from "@/lib/queries/clases.queries";
import { reservarConCupo, promoverListaEspera } from "@/lib/utils/clases-cupo";
import { hoyISO } from "@/lib/utils/dates";

export async function reservarClasePortalAction(
  slug: string,
  sesionId: string
): Promise<{ ok: boolean; error?: string; enListaEspera?: boolean }> {
  const { gym, session } = await requirePortal(slug);
  const admin = createAdminClient();

  // C4: bloquear si la membresía no está vigente (portal = bloqueo duro).
  const { data: m } = await admin
    .from("miembros")
    .select("fecha_vencimiento")
    .eq("tenant_id", gym.id)
    .eq("id", session.miembroId)
    .maybeSingle();
  const venc = m?.fecha_vencimiento as string | null | undefined;
  if (!venc || venc < hoyISO()) {
    return {
      ok: false,
      error: "Tu membresía está vencida. Renuévala para reservar clases.",
    };
  }

  const { reserva, enListaEspera, error } = await reservarConCupo(
    gym.id,
    sesionId,
    { miembroId: session.miembroId, origen: "portal" },
    admin
  );
  if (!reserva) return { ok: false, error: error ?? "No se pudo reservar." };

  revalidatePath(`/portal/${slug}/clases`);
  return { ok: true, enListaEspera };
}

export async function cancelarReservaPortalAction(
  slug: string,
  reservaId: string,
  sesionId: string
): Promise<{ ok: boolean; error?: string }> {
  const { gym } = await requirePortal(slug);
  const admin = createAdminClient();

  const { ok, error } = await cancelarReserva(gym.id, reservaId, admin);
  if (!ok) return { ok: false, error: error ?? "No se pudo cancelar." };

  // Libera cupo → promueve al primero en lista de espera (igual que el staff).
  await promoverListaEspera(gym.id, sesionId, admin);

  revalidatePath(`/portal/${slug}/clases`);
  return { ok: true };
}
