/**
 * Mapa de features por plan — fuente única de verdad para
 * qué módulos/funciones ve cada gym según su plan.
 *
 * Se usa en:
 * - components/ui/FeatureGate.tsx (bloquea UI con CTA de upgrade)
 * - lib/queries/* (si algún query depende del plan)
 */

export type Plan = "basico" | "pro" | "escala";

export type Feature =
  | "miembros"
  | "checkins"
  | "caja"
  | "dashboard_simple"
  | "inventario"
  | "dashboard_completo"
  | "prospectos"
  | "alertas_whatsapp"
  | "seguimiento_whatsapp"
  | "reportes_avanzados";

/**
 * Orden de planes, de menor a mayor — usado para calcular
 * "incluye todo lo del plan anterior".
 */
const PLAN_ORDER: Plan[] = ["basico", "pro", "escala"];

/**
 * Features que se desbloquean a partir de cada plan
 * (no acumulado aquí — la acumulación se resuelve en getFeaturesForPlan).
 */
const FEATURES_BY_PLAN: Record<Plan, Feature[]> = {
  basico: ["miembros", "checkins", "caja", "dashboard_simple"],
  pro: ["inventario", "dashboard_completo", "prospectos"],
  escala: ["alertas_whatsapp", "seguimiento_whatsapp", "reportes_avanzados"],
};

/**
 * Devuelve el set completo de features disponibles para un plan,
 * incluyendo las heredadas de planes inferiores.
 */
export function getFeaturesForPlan(plan: Plan): Set<Feature> {
  const planIndex = PLAN_ORDER.indexOf(plan);
  const features = new Set<Feature>();

  for (let i = 0; i <= planIndex; i++) {
    const planFeatures = FEATURES_BY_PLAN[PLAN_ORDER[i]];
    planFeatures.forEach((f) => features.add(f));
  }

  return features;
}

/**
 * Verifica si un plan tiene acceso a una feature específica.
 */
export function hasFeature(plan: Plan, feature: Feature): boolean {
  return getFeaturesForPlan(plan).has(feature);
}

/**
 * Devuelve el plan mínimo requerido para una feature.
 * Útil para el copy del CTA ("Mejorar a Pro").
 */
export function getRequiredPlan(feature: Feature): Plan {
  for (const plan of PLAN_ORDER) {
    if (FEATURES_BY_PLAN[plan].includes(feature)) {
      return plan;
    }
  }
  // No debería ocurrir si todas las features están mapeadas.
  return "escala";
}

export const PLAN_LABELS: Record<Plan, string> = {
  basico: "Básico",
  pro: "Pro",
  escala: "Escala",
};
