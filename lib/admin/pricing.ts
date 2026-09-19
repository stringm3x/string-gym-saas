import { PLAN_LABELS, PLAN_PRECIO_MENSUAL, type Plan } from "@/lib/features";

/**
 * Precio mensual por plan (MXN) para estimar el MRR en el Admin. Sale de
 * lib/features.ts (fuente única). Solo se usa para el cálculo de MRR y
 * rotación del panel admin; no afecta cobros de gyms.
 */
export const PLAN_MRR: Record<Plan, number> = PLAN_PRECIO_MENSUAL;

/** Etiqueta legible del plan. */
export const PLAN_LABEL: Record<Plan, string> = PLAN_LABELS;

/**
 * MRR estimado de un tenant: solo cuenta si está activo (un tenant en
 * prueba/suspendido/cancelado no aporta ingreso recurrente).
 */
export function tenantMrr(plan: string, estado: string): number {
  if (estado !== "activo") return 0;
  return PLAN_MRR[plan as Plan] ?? 0;
}
