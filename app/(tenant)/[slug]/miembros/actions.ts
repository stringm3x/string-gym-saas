"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import {
  createMiembro as dbCreateMiembro,
  updateMiembro as dbUpdateMiembro,
} from "@/lib/queries/miembros.queries";
import { miembroSchema } from "@/lib/validations/miembro.schema";

export interface MiembroFormState {
  ok: boolean;
  error: string | null;
  /**
   * Errores por campo (Zod) — para mostrar inline en el form.
   */
  fieldErrors: Partial<Record<string, string>>;
}

const emptyState: MiembroFormState = {
  ok: false,
  error: null,
  fieldErrors: {},
};

function parseFormData(formData: FormData) {
  return {
    nombre: String(formData.get("nombre") ?? ""),
    telefono: String(formData.get("telefono") ?? ""),
    email: String(formData.get("email") ?? ""),
    fecha_inscripcion: String(formData.get("fecha_inscripcion") ?? ""),
    fecha_vencimiento: String(formData.get("fecha_vencimiento") ?? ""),
    notas: String(formData.get("notas") ?? ""),
  };
}

export async function createMiembroAction(
  _prev: MiembroFormState,
  formData: FormData
): Promise<MiembroFormState> {
  const tenant = await getTenant();
  const raw = parseFormData(formData);

  const parsed = miembroSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0]?.toString();
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }

  const result = await dbCreateMiembro(tenant.id, parsed.data);
  if (!result.ok) {
    return { ...emptyState, error: result.error };
  }

  revalidatePath(`/${tenant.slug}/miembros`);
  redirect(`/${tenant.slug}/miembros/${result.id}`);
}

export async function updateMiembroAction(
  id: string,
  _prev: MiembroFormState,
  formData: FormData
): Promise<MiembroFormState> {
  const tenant = await getTenant();
  const raw = parseFormData(formData);

  const parsed = miembroSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0]?.toString();
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }

  const result = await dbUpdateMiembro(tenant.id, id, parsed.data);
  if (!result.ok) {
    return { ...emptyState, error: result.error };
  }

  revalidatePath(`/${tenant.slug}/miembros`);
  revalidatePath(`/${tenant.slug}/miembros/${id}`);
  return { ok: true, error: null, fieldErrors: {} };
}
