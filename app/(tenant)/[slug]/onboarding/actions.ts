"use server";

import { redirect } from "next/navigation";
import { panelAction } from "@/lib/authz";
import {
  getOnboardingEstado,
  marcarOnboardingCompletado,
} from "@/lib/queries/onboarding.queries";

/**
 * Marca el onboarding como completado y lleva al dashboard del owner. Exige
 * que los 2 pasos obligatorios estén hechos (planes + miembros); el
 * inventario es siempre opcional (Bloque 10 PR2: un gym Pro/Escala que no
 * vende productos no debía quedar atrapado en la guía), así que solo se
 * muestra como guía, nunca bloquea. Defensa server-side, además del botón
 * deshabilitado en la UI.
 */
export const completarOnboardingAction = panelAction(
  "onboarding.completar",
  // Sin permiso (recepción/entrenador) no hay a dónde redirigir con sentido:
  // la guía es del dueño y el botón ni se les muestra. No-op silencioso.
  { onDenied: () => undefined },
  async (tenant): Promise<void> => {
    const estado = await getOnboardingEstado(tenant.id);
    if (!estado.tienePlanes || !estado.tieneMiembros) {
      redirect(`/${tenant.slug}/onboarding?error=incompleto`);
    }

    await marcarOnboardingCompletado(tenant.id);
    const destino = tenant.has("pantalla_hoy") ? "hoy" : "dashboard";
    redirect(`/${tenant.slug}/${destino}`);
  }
);

/**
 * Salta la guía sin exigir los pasos: se puede retomar cuando quieras desde
 * Configuración → Ayuda → Guía de inicio (ese link no depende de
 * onboarding_completado, solo el redirect forzado del layout sí).
 */
export const saltarOnboardingAction = panelAction(
  "onboarding.completar",
  { onDenied: () => undefined },
  async (tenant): Promise<void> => {
    await marcarOnboardingCompletado(tenant.id);
    const destino = tenant.has("pantalla_hoy") ? "hoy" : "dashboard";
    redirect(`/${tenant.slug}/${destino}`);
  }
);
