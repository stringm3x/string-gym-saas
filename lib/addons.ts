/**
 * Catálogo de complementos contratables — funcionalidades extra por encima
 * del plan. A diferencia de los planes (uno a la vez), un gym puede tener
 * varios complementos activos simultáneamente.
 *
 * El catálogo está VACÍO a propósito: nada que no exista aparece en
 * pantalla. Los complementos comerciales vigentes (sucursal adicional,
 * paquete de conversaciones de WhatsApp) todavía no están construidos:
 * cuando lo estén, se dan de alta aquí y la UI de Configuración → Complementos
 * y del panel admin los muestra sola. La infraestructura (tabla gym_addons,
 * AddonsProvider, toggles del admin) se conserva.
 */

import type { Plan } from "@/lib/features";

/** Identificador de complemento tal como se guarda en gym_addons.addon_id. */
export type AddonId = string;

export type AddonEstado = "disponible" | "proximamente" | "en_desarrollo";

export interface AddonDefinition {
  id: AddonId;
  nombre: string;
  descripcionCorta: string;
  descripcionLarga: string;
  precio: number;
  /** Plan mínimo requerido para contratar. */
  planMinimo: Plan;
  estado: AddonEstado;
  /** Para qué fase está prevista la construcción. */
  faseConstruccion: string;
  /** Nombre del icono de react-icons/lu. */
  iconName: string;
  beneficios: string[];
}

export const ADDONS_CATALOG: AddonDefinition[] = [];

const PLAN_ORDER: Plan[] = ["basico", "pro", "escala"];

/** True si el plan actual alcanza (o supera) el plan mínimo del add-on. */
export function planCumpleAddon(planActual: Plan, planMinimo: Plan): boolean {
  return PLAN_ORDER.indexOf(planActual) >= PLAN_ORDER.indexOf(planMinimo);
}

export function getAddon(id: AddonId): AddonDefinition | undefined {
  return ADDONS_CATALOG.find((a) => a.id === id);
}

export function getAddonsDisponibles(): AddonDefinition[] {
  return ADDONS_CATALOG.filter((a) => a.estado === "disponible");
}
