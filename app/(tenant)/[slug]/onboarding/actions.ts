"use server";

import { redirect } from "next/navigation";
import { panelAction } from "@/lib/authz";
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
export const completarOnboardingAction = panelAction(
  "onboarding.completar",
  // Sin permiso (recepción/entrenador) no hay a dónde redirigir con sentido:
  // la guía es del dueño y el botón ni se les muestra. No-op silencioso.
  { onDenied: () => undefined },
  async (tenant): Promise<void> => {
    const estado = await getOnboardingEstado(tenant.id);
    // El inventario solo aplica a planes con la feature (Pro/Escala); en Básico
    // no existe, así que no se exige producto para completar.
    const requiereProducto = tenant.has("inventario");
    if (
      !estado.tienePlanes ||
      !estado.tieneMiembros ||
      (requiereProducto && !estado.tieneProductos)
    ) {
      redirect(`/${tenant.slug}/onboarding?error=incompleto`);
    }

    await marcarOnboardingCompletado(tenant.id);
    const destino = tenant.has("pantalla_hoy") ? "hoy" : "dashboard";
    redirect(`/${tenant.slug}/${destino}`);
  }
);
