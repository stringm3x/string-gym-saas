"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { panelAction } from "@/lib/authz";
import {
  getSesionById,
  cancelarReserva,
  checkInReserva,
  marcarNoShow,
  cancelarSesion,
} from "@/lib/queries/clases.queries";
import {
  searchMiembrosForCheckin,
  getMiembro,
} from "@/lib/queries/miembros.queries";
import { hoyISO } from "@/lib/utils/dates";
import { reservarConCupo, promoverListaEspera } from "@/lib/utils/clases-cupo";
import { crearProspectoDesdeClaseGratis } from "@/lib/utils/clases-prospecto";

export interface SesionActionResult {
  ok: boolean;
  error?: string;
  enListaEspera?: boolean;
  /** C4: aviso no bloqueante (ej. socio con membresía vencida). */
  advertencia?: string;
}

// Operar (ver_clases: owner, gerente, recepción, entrenador) vs gestionar
// (gestionar_clases: cancelar la sesión) viven en lib/authz/politicas.ts.

function revalidate(slug: string, sesionId: string) {
  revalidatePath(`/${slug}/clases/${sesionId}`);
}

export const buscarMiembrosAction = panelAction(
  "clases.buscar_miembros",
  { onDenied: () => [] },
  async (t, query: string) => searchMiembrosForCheckin(t.id, query)
);

export const createReservaAction = panelAction(
  "clases.reservar",
  {},
  async (
    t,
    sesionId: string,
    input: {
      miembroId?: string | null;
      nombreVisitante?: string | null;
      telefonoVisitante?: string | null;
    }
  ): Promise<SesionActionResult> => {
    const sesion = await getSesionById(t.id, sesionId);
    if (!sesion) return { ok: false, error: "Sesión no encontrada." };
    if (sesion.estado === "cancelada") {
      return { ok: false, error: "La sesión está cancelada." };
    }

    const { reserva, enListaEspera, error } = await reservarConCupo(t.id, sesionId, {
      miembroId: input.miembroId ?? null,
      nombreVisitante: input.nombreVisitante ?? null,
      telefonoVisitante: input.telefonoVisitante ?? null,
    });
    if (!reserva) return { ok: false, error: error ?? "No se pudo reservar." };

    // Clase gratis + visitante nuevo → prospecto automático en el CRM.
    if (sesion.clase?.tipo === "gratis" && !input.miembroId) {
      await crearProspectoDesdeClaseGratis(
        t.id,
        { tipo: "gratis", nombre: sesion.clase.nombre },
        { id: reserva.id },
        { nombre: input.nombreVisitante, telefono: input.telefonoVisitante },
        sesion.fecha
      );
    }

    // C4: staff puede reservar a un socio vencido, pero se avisa (no bloquea).
    let advertencia: string | undefined;
    if (input.miembroId) {
      const miembro = await getMiembro(t.id, input.miembroId);
      const venc = miembro?.fecha_vencimiento;
      if (!venc || venc < hoyISO()) {
        advertencia = "Este socio tiene la membresía vencida.";
      }
    }

    revalidate(t.slug, sesionId);
    return { ok: true, enListaEspera, advertencia };
  }
);

export const cancelarReservaAction = panelAction(
  "clases.cancelar_reserva",
  {},
  async (t, sesionId: string, reservaId: string): Promise<SesionActionResult> => {
    const { ok, error } = await cancelarReserva(t.id, reservaId);
    if (!ok) return { ok: false, error };

    // Al liberarse un lugar, promover al primero en lista de espera.
    await promoverListaEspera(t.id, sesionId);

    revalidate(t.slug, sesionId);
    return { ok: true };
  }
);

export const checkInReservaAction = panelAction(
  "clases.checkin_reserva",
  {},
  async (t, sesionId: string, reservaId: string): Promise<SesionActionResult> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sesión expirada." };

    const { ok, error } = await checkInReserva(t.id, reservaId, user.id);
    if (!ok) return { ok: false, error };

    revalidate(t.slug, sesionId);
    return { ok: true };
  }
);

export const marcarNoShowAction = panelAction(
  "clases.no_show",
  {},
  async (t, sesionId: string, reservaId: string): Promise<SesionActionResult> => {
    const { ok, error } = await marcarNoShow(t.id, reservaId);
    if (!ok) return { ok: false, error };

    revalidate(t.slug, sesionId);
    return { ok: true };
  }
);

export const cancelarSesionAction = panelAction(
  "clases.cancelar_sesion",
  {},
  async (t, sesionId: string, motivo?: string): Promise<SesionActionResult> => {
    const { ok, error } = await cancelarSesion(t.id, sesionId, motivo);
    if (!ok) return { ok: false, error };

    revalidate(t.slug, sesionId);
    return { ok: true };
  }
);
