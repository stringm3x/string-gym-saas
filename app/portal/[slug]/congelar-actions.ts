"use server";

import { revalidatePath } from "next/cache";
import { portalAction } from "@/lib/authz";
import { solicitarCongelacionPortal } from "@/lib/queries/miembro-eventos.queries";

export const solicitarCongelacionAction = portalAction(
  "portal.congelar",
  {},
  async (
    { gym, session, admin },
    fechaInicio: string,
    fechaFin: string
  ): Promise<{ ok: boolean; error?: string; aplicada?: boolean }> => {
    if (!fechaInicio || !fechaFin) {
      return { ok: false, error: "Indica las fechas de la pausa." };
    }

    const r = await solicitarCongelacionPortal(
      gym.id,
      session.miembroId,
      { fechaInicio, fechaFin },
      admin
    );
    if (!r.ok) return { ok: false, error: r.error };

    revalidatePath(`/portal/${gym.slug}`);
    return { ok: true, aplicada: r.aplicada };
  }
);
