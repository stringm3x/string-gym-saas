/**
 * Mapa de features por plan — fuente única de verdad para qué módulos y
 * funciones ve cada gym según su plan. Sigue el KB Maestro STRING (sept
 * 2026, Parte 4) y lo que publica stringwebs.com/saas.
 *
 * Identificadores internos: `basico` (Starter), `pro`, `escala`. El id
 * `basico` se conserva porque vive en gyms.plan, en el CHECK de
 * solicitudes_prueba y en el formulario de alta de la web; la etiqueta
 * comercial es "Starter" (PLAN_LABELS).
 *
 * Se usa en:
 * - components/ui/UpgradePage.tsx (pantalla completa de upgrade)
 * - Sidebar, ConfigNav, páginas y server actions gateadas
 *
 * Cada plan lista SOLO las features que desbloquea; la herencia
 * (un plan incluye lo de los inferiores) se resuelve en hasFeature.
 */

export type Plan = "basico" | "pro" | "escala";

export const planFeatures = {
  // STARTER — "Sal del cuaderno" ($799/mes, anual $7,990).
  // Socios ilimitados · check-in manual, QR y kiosco · caja, corte y recibo ·
  // membresías y planes por visitas · congelar y cambio de plan · panel del
  // día y del mes · importación CSV · logo y color de marca hacia el socio ·
  // exportación · soporte 48 h.
  basico: [
    // Descriptivas (no se enforcean con hasFeature; el gating real es por rol).
    "miembros",
    "checkins",
    "caja_basica",
    "catalogo_planes",
    "recibos",
    "archivar_miembros",
    "pagar_al_inscribir",
    "importacion_csv",
    // Enforceadas.
    "qr_access", // check-in por QR (scanner del staff) y kiosco de entrada
    "pantalla_hoy", // panel del día
    "dashboard_simple", // panel del mes (cifras y gráficas básicas)
    "personalizacion_logo",
    "color_gimnasio", // acento del gym hacia el socio: portal, kiosco, QR, recibo
    "exportacion_datos", // CSV de miembros
  ],
  // PRO — "Vende más en el mismo local" ($1,799/mes, anual $17,990).
  // Todo Starter, más: inventario y punto de venta · promociones · clases con
  // reservas y lista de espera · kiosco de autoservicio · pagos en línea ·
  // créditos y pagos a plazos · multiusuario con roles · panel completo
  // (MRR, ARPU, LTV, rotación) · socios en riesgo en el panel · WhatsApp
  // manual a un clic · campañas · etiquetas, notas y vencimientos · API
  // pública y componentes web · reportes CSV y PDF · opiniones del socio y
  // reseñas en Google Maps · soporte 24 h.
  pro: [
    "inventario",
    "promociones",
    "clases",
    "kiosco_autoservicio",
    "mercadopago",
    "creditos",
    "multiusuario",
    "dashboard_completo", // MRR, ARPU, LTV, rotación
    "riesgo_panel", // lista de socios en riesgo (14 días sin check-in) en el panel
    "whatsapp_manual", // botones "WhatsApp" a un clic con plantillas
    "acciones_rapidas",
    "campanas",
    "tags",
    "timeline_notas",
    "plantillas_mensaje",
    "bulk_actions",
    "prospectos",
    "api",
    "reportes", // reporte financiero, CSV e impresión
    "opiniones", // opiniones del socio y reseñas en Google Maps
  ],
  // ESCALA — "El sistema trabaja y te avisa" ($2,999/mes, anual $29,990).
  // Todo Pro, más: WhatsApp automático al socio · alertas al dueño por
  // WhatsApp · bot · inbox · nutrición · portal del socio · soporte 4 h.
  escala: [
    "whatsapp_automatico", // avisos al socio, bot e inbox
    "alertas_dueno", // pantalla de alertas + aviso al dueño por WhatsApp
    "nutricion",
    "portal_miembro",
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

/** Nombre comercial del plan (el id interno de Starter sigue siendo `basico`). */
export const PLAN_LABELS: Record<Plan, string> = {
  basico: "Starter",
  pro: "Pro",
  escala: "Escala",
};

/** Precio mensual publicado (MXN). Anual = diez meses por doce. */
export const PLAN_PRECIO_MENSUAL: Record<Plan, number> = {
  basico: 799,
  pro: 1799,
  escala: 2999,
};
