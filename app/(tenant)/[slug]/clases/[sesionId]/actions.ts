"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { hasFeature } from "@/lib/features";
import {
  getSesionById,
  cancelarReserva,
  checkInReserva,
  cancelarSesion,
} from "@/lib/queries/clases.queries";
import { searchMiembrosForCheckin } from "@/lib/queries/miembros.queries";
import { reservarConCupo, promoverListaEspera } from "@/lib/utils/clases-cupo";
import { crearProspectoDesdeClaseGratis } from "@/lib/utils/clases-prospecto";
import type { StaffRol } from "@/lib/types/staff";
import type { Plan } from "@/lib/features";

export interface SesionActionResult {
  ok: boolean;
  error?: string;
  enListaEspera?: boolean;
}

interface Ctx {
  id: string;
  slug: string;
  role: StaffRol;
  plan: Plan;
}

/** Acceso operativo (owner + recepcionista) con feature 'clases'. */
async function gateOperar(): Promise<Ctx | null> {
  const t = await getTenant();
  if (!hasFeature(t.plan, "clases") || !hasPermission(t.role, "ver_clases")) {
    return null;
  }
  return t;
}

/** Acciones de gestión (solo owner). */
async function gateGestionar(): Promise<Ctx | null> {
  const t = await getTenant();
  if (!hasFeature(t.plan, "clases") || !hasPermission(t.role, "gestionar_clases")) {
    return null;
  }
  return t;
}

function revalidate(slug: string, sesionId: string) {
  revalidatePath(`/${slug}/clases/${sesionId}`);
}

export async function buscarMiembrosAction(query: string) {
  const t = await gateOperar();
  if (!t) return [];
  return searchMiembrosForCheckin(t.id, query);
}

export async function createReservaAction(
  sesionId: string,
  input: {
    miembroId?: string | null;
    nombreVisitante?: string | null;
    telefonoVisitante?: string | null;
  }
): Promise<SesionActionResult> {
  const t = await gateOperar();
  if (!t) return { ok: false, error: "No autorizado." };

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

  revalidate(t.slug, sesionId);
  return { ok: true, enListaEspera };
}

export async function cancelarReservaAction(
  sesionId: string,
  reservaId: string
): Promise<SesionActionResult> {
  const t = await gateOperar();
  if (!t) return { ok: false, error: "No autorizado." };

  const { ok, error } = await cancelarReserva(t.id, reservaId);
  if (!ok) return { ok: false, error };

  // Al liberarse un lugar, promover al primero en lista de espera.
  await promoverListaEspera(t.id, sesionId);

  revalidate(t.slug, sesionId);
  return { ok: true };
}

export async function checkInReservaAction(
  sesionId: string,
  reservaId: string
): Promise<SesionActionResult> {
  const t = await gateOperar();
  if (!t) return { ok: false, error: "No autorizado." };

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

export async function cancelarSesionAction(
  sesionId: string,
  motivo?: string
): Promise<SesionActionResult> {
  const t = await gateGestionar();
  if (!t) return { ok: false, error: "No autorizado." };

  const { ok, error } = await cancelarSesion(t.id, sesionId, motivo);
  if (!ok) return { ok: false, error };

  revalidate(t.slug, sesionId);
  return { ok: true };
}
