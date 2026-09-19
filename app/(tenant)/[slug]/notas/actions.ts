"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import type { Permission } from "@/lib/types/staff";
import {
  createNota,
  listNotas,
  toggleNotaCompletada,
  type Nota,
  type TipoAccion,
} from "@/lib/queries/notas.queries";

export interface NotaFormState {
  ok: boolean;
  error: string | null;
}

/** Notas de miembro se gatean como editar_miembros; de prospecto, como ver_prospectos. */
function permisoNotas(entidadTipo: "miembro" | "prospecto"): Permission {
  return entidadTipo === "miembro" ? "editar_miembros" : "ver_prospectos";
}

export async function createNotaAction(
  entidadTipo: "miembro" | "prospecto",
  entidadId: string,
  _prev: NotaFormState,
  formData: FormData
): Promise<NotaFormState> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, permisoNotas(entidadTipo))) {
    return { ok: false, error: "No tienes permiso para esta acción." };
  }
  const contenido = String(formData.get("contenido") ?? "").trim();
  const fechaSeguimiento = String(formData.get("fecha_seguimiento") ?? "").trim();

  if (!contenido) return { ok: false, error: "La nota no puede estar vacía" };

  const result = await createNota(
    tenant.id,
    entidadTipo,
    entidadId,
    contenido,
    undefined,
    fechaSeguimiento || null
  );
  if (!result.ok) return { ok: false, error: result.error };

  if (entidadTipo === "miembro") {
    revalidatePath(`/${tenant.slug}/miembros/${entidadId}`);
    revalidatePath(`/${tenant.slug}/miembros`);
  } else {
    revalidatePath(`/${tenant.slug}/prospectos`);
  }

  return { ok: true, error: null };
}

export async function toggleNotaCompletadaAction(
  notaId: string,
  completada: boolean
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();
  // Solo se usa en la ficha del miembro (NotasTimeline/SeguimientosPendientes).
  if (!hasPermission(tenant.role, "editar_miembros")) {
    return { ok: false, error: "No tienes permiso para esta acción." };
  }
  const result = await toggleNotaCompletada(tenant.id, notaId, completada);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/${tenant.slug}/miembros`);
  return { ok: true };
}

export async function registrarAccionAction(
  entidadTipo: "miembro" | "prospecto",
  entidadId: string,
  contenido: string,
  tipoAccion: TipoAccion
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, permisoNotas(entidadTipo))) {
    return { ok: false, error: "No tienes permiso para esta acción." };
  }

  const result = await createNota(
    tenant.id,
    entidadTipo,
    entidadId,
    contenido,
    tipoAccion
  );

  if (!result.ok) return { ok: false, error: result.error };

  if (entidadTipo === "miembro") {
    revalidatePath(`/${tenant.slug}/miembros/${entidadId}`);
  } else {
    revalidatePath(`/${tenant.slug}/prospectos`);
  }

  return { ok: true };
}

export async function listNotasAction(
  entidadTipo: "miembro" | "prospecto",
  entidadId: string
): Promise<Nota[]> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, permisoNotas(entidadTipo))) return [];
  return listNotas(tenant.id, entidadTipo, entidadId);
}
