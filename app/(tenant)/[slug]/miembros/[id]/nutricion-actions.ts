"use server";

import { revalidatePath } from "next/cache";
import { panelAction } from "@/lib/authz";
import {
  createPlanNutricion,
  updatePlanNutricion,
  archivarPlanNutricion,
} from "@/lib/queries/nutricion.queries";
import { planNutricionInputSchema } from "@/lib/validations/nutricion.schema";

type Resultado = { ok: boolean; error?: string };

export const crearPlanNutricionAction = panelAction(
  "miembros.nutricion_crear",
  {},
  async (tenant, miembroId: string, input: unknown): Promise<Resultado> => {
    const parsed = planNutricionInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      };
    }

    const r = await createPlanNutricion(tenant.id, miembroId, parsed.data);
    if (!r.ok) return { ok: false, error: r.error };

    revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
    return { ok: true };
  }
);

export const editarPlanNutricionAction = panelAction(
  "miembros.nutricion_editar",
  {},
  async (tenant, miembroId: string, planId: string, input: unknown): Promise<Resultado> => {
    const parsed = planNutricionInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      };
    }

    const r = await updatePlanNutricion(tenant.id, planId, parsed.data);
    if (!r.ok) return { ok: false, error: r.error };

    revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
    return { ok: true };
  }
);

export const archivarPlanNutricionAction = panelAction(
  "miembros.nutricion_archivar",
  {},
  async (tenant, miembroId: string, planId: string): Promise<Resultado> => {
    const r = await archivarPlanNutricion(tenant.id, planId);
    if (!r.ok) return { ok: false, error: r.error };

    revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
    return { ok: true };
  }
);
