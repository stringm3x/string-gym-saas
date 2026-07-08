"use server";

import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { marcarOnboardingCompletado } from "@/lib/queries/onboarding.queries";

/** Marca el onboarding como completado y lleva al dashboard del owner. */
export async function completarOnboardingAction() {
  const tenant = await getTenant();
  await marcarOnboardingCompletado(tenant.id);
  const destino = hasFeature(tenant.plan, "pantalla_hoy") ? "hoy" : "dashboard";
  redirect(`/${tenant.slug}/${destino}`);
}
