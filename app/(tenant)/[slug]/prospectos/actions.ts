"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import {
  createProspecto,
  updateProspecto,
  updateEstadoProspecto,
} from "@/lib/queries/prospectos.queries";
import { prospectoSchema } from "@/lib/validations/prospecto.schema";
import type { ProspectoEstado } from "@/lib/validations/prospecto.schema";

export interface ProspectoFormState {
  ok: boolean;
  error: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

const emptyState: ProspectoFormState = {
  ok: false,
  error: null,
  fieldErrors: {},
};

function parseFormData(formData: FormData) {
  return {
    nombre: String(formData.get("nombre") ?? ""),
    telefono: String(formData.get("telefono") ?? ""),
    email: String(formData.get("email") ?? ""),
    origen: String(formData.get("origen") ?? "manual"),
    estado: String(formData.get("estado") ?? "nuevo"),
    fecha_prueba_agendada: String(formData.get("fecha_prueba_agendada") ?? ""),
    notas: String(formData.get("notas") ?? ""),
  };
}

function collectFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    const path = key !== undefined ? String(key) : undefined;
    if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
  }
  return fieldErrors;
}

export async function createProspectoAction(
  _prev: ProspectoFormState,
  formData: FormData
): Promise<ProspectoFormState> {
  const tenant = await getTenant();
  const raw = { ...parseFormData(formData), estado: "nuevo" as const };

  const parsed = prospectoSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los campos marcados.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const result = await createProspecto(tenant.id, parsed.data);
  if (!result.ok) {
    return { ...emptyState, error: result.error };
  }

  revalidatePath(`/${tenant.slug}/prospectos`);
  return { ok: true, error: null, fieldErrors: {} };
}

export async function updateProspectoAction(
  id: string,
  _prev: ProspectoFormState,
  formData: FormData
): Promise<ProspectoFormState> {
  const tenant = await getTenant();
  const raw = parseFormData(formData);

  const parsed = prospectoSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los campos marcados.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const result = await updateProspecto(tenant.id, id, parsed.data);
  if (!result.ok) {
    return { ...emptyState, error: result.error };
  }

  revalidatePath(`/${tenant.slug}/prospectos`);
  return { ok: true, error: null, fieldErrors: {} };
}

export async function cambiarEstadoAction(
  id: string,
  nuevoEstado: ProspectoEstado
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();

  const result = await updateEstadoProspecto(tenant.id, id, nuevoEstado);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(`/${tenant.slug}/prospectos`);
  return { ok: true };
}
