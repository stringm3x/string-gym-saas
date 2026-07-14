"use server";

import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import {
  getOnboardingEstado,
  marcarOnboardingCompletado,
} from "@/lib/queries/onboarding.queries";

/**
 * Marca el onboarding como completado y lleva al dashboard del owner. Exige que
 * los 3 pasos estén hechos (planes + miembros + inventario); si falta alguno,
 * vuelve a la guía con un aviso (defensa server-side, además del botón
 * deshabilitado en la UI).
 */
export async function completarOnboardingAction() {
  const tenant = await getTenant();

  const estado = await getOnboardingEstado(tenant.id);
  // El inventario solo aplica a planes con la feature (Pro/Escala); en Básico
  // no existe, así que no se exige producto para completar.
  const requiereProducto = hasFeature(tenant.plan, "inventario");
  if (
    !estado.tienePlanes ||
    !estado.tieneMiembros ||
    (requiereProducto && !estado.tieneProductos)
  ) {
    redirect(`/${tenant.slug}/onboarding?error=incompleto`);
  }

  await marcarOnboardingCompletado(tenant.id);
  const destino = hasFeature(tenant.plan, "pantalla_hoy") ? "hoy" : "dashboard";
  redirect(`/${tenant.slug}/${destino}`);
}
