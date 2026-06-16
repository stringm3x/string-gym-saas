"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import {
  createNota,
  listNotas,
  type Nota,
  type TipoAccion,
} from "@/lib/queries/notas.queries";

export interface NotaFormState {
  ok: boolean;
  error: string | null;
}

export async function createNotaAction(
  entidadTipo: "miembro" | "prospecto",
  entidadId: string,
  _prev: NotaFormState,
  formData: FormData
): Promise<NotaFormState> {
  const tenant = await getTenant();
  const contenido = String(formData.get("contenido") ?? "").trim();

  if (!contenido) return { ok: false, error: "La nota no puede estar vacía" };

  const result = await createNota(tenant.id, entidadTipo, entidadId, contenido);
  if (!result.ok) return { ok: false, error: result.error };

  if (entidadTipo === "miembro") {
    revalidatePath(`/${tenant.slug}/miembros/${entidadId}`);
  } else {
    revalidatePath(`/${tenant.slug}/prospectos`);
  }

  return { ok: true, error: null };
}

export async function registrarAccionAction(
  entidadTipo: "miembro" | "prospecto",
  entidadId: string,
  contenido: string,
  tipoAccion: TipoAccion
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();

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
  return listNotas(tenant.id, entidadTipo, entidadId);
}
