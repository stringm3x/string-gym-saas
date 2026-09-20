"use server";

import { revalidatePath } from "next/cache";
import { panelAction, type Denegado } from "@/lib/authz";
import {
  createProspecto,
  updateProspecto,
  updateEstadoProspecto,
} from "@/lib/queries/prospectos.queries";
import { syncTagsForProspecto } from "@/lib/queries/tags.queries";
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
const denegar = (d: Denegado): ProspectoFormState => ({ ...emptyState, error: d.error });

function parseFormData(formData: FormData) {
  return {
    nombre: String(formData.get("nombre") ?? ""),
    telefono: String(formData.get("telefono") ?? ""),
    email: String(formData.get("email") ?? ""),
    origen: String(formData.get("origen") ?? "manual"),
    estado: String(formData.get("estado") ?? "nuevo"),
    fecha_prueba_agendada: String(formData.get("fecha_prueba_agendada") ?? ""),
    notas: String(formData.get("notas") ?? ""),
    tag_ids: formData.getAll("tag_ids").map(String),
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

export const createProspectoAction = panelAction(
  "prospectos.crear",
  { onDenied: denegar },
  async (tenant, _prev: ProspectoFormState, formData: FormData): Promise<ProspectoFormState> => {
    const { tag_ids, ...rest } = parseFormData(formData);
    const raw = { ...rest, estado: "nuevo" as const };

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

    await syncTagsForProspecto(tenant.id, result.id, tag_ids);

    revalidatePath(`/${tenant.slug}/prospectos`);
    return { ok: true, error: null, fieldErrors: {} };
  }
);

export const updateProspectoAction = panelAction(
  "prospectos.editar",
  { onDenied: denegar },
  async (
    tenant,
    id: string,
    _prev: ProspectoFormState,
    formData: FormData
  ): Promise<ProspectoFormState> => {
    const { tag_ids, ...raw } = parseFormData(formData);

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

    await syncTagsForProspecto(tenant.id, id, tag_ids);

    revalidatePath(`/${tenant.slug}/prospectos`);
    return { ok: true, error: null, fieldErrors: {} };
  }
);

export const cambiarEstadoAction = panelAction(
  "prospectos.cambiar_estado",
  {},
  async (tenant, id: string, nuevoEstado: ProspectoEstado): Promise<{ ok: boolean; error?: string }> => {
    const result = await updateEstadoProspecto(tenant.id, id, nuevoEstado);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    revalidatePath(`/${tenant.slug}/prospectos`);
    return { ok: true };
  }
);
