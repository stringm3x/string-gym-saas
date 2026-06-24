import type { Plan } from "@/lib/features";

/**
 * Precio mensual por plan (MXN) para estimar el MRR en el Admin.
 * Solo se usa para el cálculo de MRR/churn del panel admin; no afecta
 * cobros de gyms.
 */
export const PLAN_MRR: Record<Plan, number> = {
  basico: 999,
  pro: 1999,
  escala: 2999,
};

/** Etiqueta legible del plan. */
export const PLAN_LABEL: Record<Plan, string> = {
  basico: "Básico",
  pro: "Pro",
  escala: "Escala",
};

/**
 * MRR estimado de un tenant: solo cuenta si está activo (un tenant en
 * prueba/suspendido/cancelado no aporta ingreso recurrente).
 */
export function tenantMrr(plan: string, estado: string): number {
  if (estado !== "activo") return 0;
  return PLAN_MRR[plan as Plan] ?? 0;
}
