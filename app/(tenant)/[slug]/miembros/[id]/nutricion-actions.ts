"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import {
  createPlanNutricion,
  updatePlanNutricion,
  archivarPlanNutricion,
} from "@/lib/queries/nutricion.queries";
import { planNutricionInputSchema } from "@/lib/validations/nutricion.schema";

type Resultado = { ok: boolean; error?: string };

export async function crearPlanNutricionAction(
  miembroId: string,
  input: unknown
): Promise<Resultado> {
  const tenant = await getTenant();
  if (!hasFeature(tenant.plan, "nutricion")) {
    return { ok: false, error: "Tu plan no incluye Nutrición." };
  }

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

export async function editarPlanNutricionAction(
  miembroId: string,
  planId: string,
  input: unknown
): Promise<Resultado> {
  const tenant = await getTenant();
  if (!hasFeature(tenant.plan, "nutricion")) {
    return { ok: false, error: "Tu plan no incluye Nutrición." };
  }

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

export async function archivarPlanNutricionAction(
  miembroId: string,
  planId: string
): Promise<Resultado> {
  const tenant = await getTenant();
  if (!hasFeature(tenant.plan, "nutricion")) {
    return { ok: false, error: "Tu plan no incluye Nutrición." };
  }

  const r = await archivarPlanNutricion(tenant.id, planId);
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
  return { ok: true };
}
