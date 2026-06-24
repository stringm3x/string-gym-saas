/**
 * Mapa de features por plan — fuente única de verdad para
 * qué módulos/funciones ve cada gym según su plan.
 *
 * Se usa en:
 * - components/ui/FeatureGate.tsx (bloquea UI inline con CTA)
 * - components/ui/UpgradePage.tsx (pantalla completa de upgrade)
 * - Sidebar, ConfigTabs, páginas y acciones gateadas
 *
 * Cada plan lista SOLO las features que desbloquea; la herencia
 * (un plan incluye lo de los inferiores) se resuelve en hasFeature.
 */

export type Plan = "basico" | "pro" | "escala";

export const planFeatures = {
  basico: [
    "miembros",
    "checkins",
    "caja_basica",
    "dashboard_simple",
    "catalogo_planes",
    "recibos",
    "acciones_rapidas",
    "archivar_miembros",
    "pagar_al_inscribir",
    "personalizacion_logo",
  ],
  pro: [
    "inventario",
    "promociones",
    "prospectos",
    "tags",
    "timeline_notas",
    "plantillas_mensaje",
    "bulk_actions",
    "pantalla_hoy",
    "dashboard_completo",
    "personalizacion_colores",
    "clases",
    "api",
    "qr_access",
  ],
  escala: [
    "alertas_dueno",
    "whatsapp_automatico",
    "reportes_avanzados",
    "personalizacion_avanzada",
  ],
} as const;

export type Feature = (typeof planFeatures)[Plan][number];

/** Orden de planes, de menor a mayor. */
const planHierarchy: Plan[] = ["basico", "pro", "escala"];

/**
 * Devuelve el set completo de features de un plan, incluyendo
 * las heredadas de los planes inferiores.
 */
export function getFeaturesForPlan(plan: Plan): Set<Feature> {
  const index = planHierarchy.indexOf(plan);
  const features = new Set<Feature>();
  if (index === -1) return features;

  for (let i = 0; i <= index; i++) {
    for (const f of planFeatures[planHierarchy[i]]) {
      features.add(f);
    }
  }
  return features;
}

/**
 * Verifica si un plan tiene acceso a una feature (con herencia).
 */
export function hasFeature(plan: Plan, feature: Feature): boolean {
  const index = planHierarchy.indexOf(plan);
  if (index === -1) return false;
  for (let i = 0; i <= index; i++) {
    if (
      (planFeatures[planHierarchy[i]] as readonly string[]).includes(feature)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Plan mínimo requerido para una feature — útil para el CTA de upgrade.
 */
export function getRequiredPlan(feature: Feature): Plan {
  for (const plan of planHierarchy) {
    if ((planFeatures[plan] as readonly string[]).includes(feature)) {
      return plan;
    }
  }
  return "escala";
}

export const PLAN_LABELS: Record<Plan, string> = {
  basico: "Básico",
  pro: "Pro",
  escala: "Escala",
};
