"use server";

import { revalidatePath } from "next/cache";
import { portalAction } from "@/lib/authz";
import { cancelarReserva } from "@/lib/queries/clases.queries";
import { reservarConCupo, promoverListaEspera } from "@/lib/utils/clases-cupo";
import { hoyISO } from "@/lib/utils/dates";

export const reservarClasePortalAction = portalAction(
  "portal.reservar_clase",
  {},
  async (
    { gym, session, admin },
    sesionId: string
  ): Promise<{ ok: boolean; error?: string; enListaEspera?: boolean }> => {
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

    revalidatePath(`/portal/${gym.slug}/clases`);
    return { ok: true, enListaEspera };
  }
);

export const cancelarReservaPortalAction = portalAction(
  "portal.cancelar_reserva",
  {},
  async (
    { gym, session, admin },
    reservaId: string,
    sesionId: string
  ): Promise<{ ok: boolean; error?: string }> => {
    // La query exige que la reserva sea del socio de la sesión: sin eso,
    // cualquier socio autenticado podía cancelar la de OTRO con su reservaId.
    const { ok, error } = await cancelarReserva(
      gym.id,
      reservaId,
      admin,
      session.miembroId
    );
    if (!ok) return { ok: false, error: error ?? "No se pudo cancelar." };

    // Libera cupo → promueve al primero en lista de espera (igual que el staff).
    await promoverListaEspera(gym.id, sesionId, admin);

    revalidatePath(`/portal/${gym.slug}/clases`);
    return { ok: true };
  }
);
