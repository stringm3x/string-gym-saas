"use server";

import { revalidatePath } from "next/cache";
import { panelAction, type Denegado } from "@/lib/authz";
import {
  createPlantilla,
  updatePlantilla,
  deletePlantilla,
  toggleActivoPlantilla,
  seedPlantillas,
} from "@/lib/queries/plantillas.queries";
import { plantillaSchema } from "@/lib/validations/plantilla.schema";

export interface PlantillaFormState {
  ok: boolean;
  error: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

const empty: PlantillaFormState = { ok: false, error: null, fieldErrors: {} };
const denegar = (d: Denegado): PlantillaFormState => ({ ...empty, error: d.error });

function parseFormData(formData: FormData) {
  return {
    nombre: String(formData.get("nombre") ?? ""),
    categoria: String(formData.get("categoria") ?? "general"),
    contenido: String(formData.get("contenido") ?? ""),
    activo: formData.get("activo") !== "false",
  };
}

function collectFieldErrors(
  issues: { path: PropertyKey[]; message: string }[]
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    const path = key !== undefined ? String(key) : undefined;
    if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
  }
  return fieldErrors;
}

export const createPlantillaAction = panelAction(
  "config.plantilla_crear",
  { onDenied: denegar },
  async (tenant, _prev: PlantillaFormState, formData: FormData): Promise<PlantillaFormState> => {
    const raw = parseFormData(formData);

    const parsed = plantillaSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Revisa los campos marcados.",
        fieldErrors: collectFieldErrors(parsed.error.issues),
      };
    }

    const result = await createPlantilla(tenant.id, parsed.data);
    if (!result.ok) return { ...empty, error: result.error };

    revalidatePath(`/${tenant.slug}/configuracion/plantillas`);
    return { ok: true, error: null, fieldErrors: {} };
  }
);

export const updatePlantillaAction = panelAction(
  "config.plantilla_editar",
  { onDenied: denegar },
  async (
    tenant,
    id: string,
    _prev: PlantillaFormState,
    formData: FormData
  ): Promise<PlantillaFormState> => {
    const raw = parseFormData(formData);

    const parsed = plantillaSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Revisa los campos marcados.",
        fieldErrors: collectFieldErrors(parsed.error.issues),
      };
    }

    const result = await updatePlantilla(tenant.id, id, parsed.data);
    if (!result.ok) return { ...empty, error: result.error };

    revalidatePath(`/${tenant.slug}/configuracion/plantillas`);
    return { ok: true, error: null, fieldErrors: {} };
  }
);

export const deletePlantillaAction = panelAction(
  "config.plantilla_borrar",
  {},
  async (tenant, id: string): Promise<{ ok: boolean; error?: string }> => {
    const result = await deletePlantilla(tenant.id, id);
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath(`/${tenant.slug}/configuracion/plantillas`);
    return { ok: true };
  }
);

export const toggleActivoAction = panelAction(
  "config.plantilla_toggle",
  {},
  async (tenant, id: string, activo: boolean): Promise<{ ok: boolean; error?: string }> => {
    const result = await toggleActivoPlantilla(tenant.id, id, activo);
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath(`/${tenant.slug}/configuracion/plantillas`);
    return { ok: true };
  }
);

export const seedPlantillasAction = panelAction(
  "config.plantillas_seed",
  {},
  async (tenant): Promise<{ ok: boolean; count?: number; error?: string }> => {
    const result = await seedPlantillas(tenant.id);
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath(`/${tenant.slug}/configuracion/plantillas`);
    return { ok: true, count: result.count };
  }
);
