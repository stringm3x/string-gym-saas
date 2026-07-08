/**
 * Catálogo de add-ons contratables — funcionalidades extra por encima
 * del plan. A diferencia de los planes (uno a la vez), un gym puede
 * tener varios add-ons activos simultáneamente.
 *
 * En esta fase (6.6) solo existe la infraestructura: el catálogo,
 * el tracking de activaciones y la UI de upsell. Los add-ons reales
 * se construyen en Fase 7+.
 */

import type { Plan } from "@/lib/features";

export type AddonId =
  | "ia_rutinas"
  | "chatbot_captacion"
  | "cfdi_facturacion"
  | "multisucursal";

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

export const ADDONS_CATALOG: AddonDefinition[] = [
  {
    id: "ia_rutinas",
    nombre: "Rutinas inteligentes con IA",
    descripcionCorta: "Generación automática de rutinas personalizadas",
    descripcionLarga:
      "Chatbot conversacional que recolecta variables del cliente (objetivo, físico, lesiones, disponibilidad) y genera rutinas personalizadas con IA. Tus entrenadores aprueban y editan antes de entregar. Seguimiento de adherencia con datos de check-in.",
    precio: 499,
    planMinimo: "basico",
    estado: "en_desarrollo",
    faseConstruccion: "Fase 8",
    iconName: "LuSparkles",
    beneficios: [
      "Chatbot recolecta variables del cliente",
      "Rutinas generadas con IA personalizadas",
      "Aprobación de entrenadores antes de entregar",
      "Tracking de adherencia con check-ins",
      "Ajuste progresivo según resultados",
    ],
  },
  {
    id: "chatbot_captacion",
    nombre: "Chatbot de captación 24/7",
    descripcionCorta: "Bot que responde y captura prospectos en WhatsApp/Web",
    descripcionLarga:
      "Tu chatbot atiende clientes potenciales 24/7. Responde preguntas frecuentes (horarios, precios, ubicación), captura datos del prospecto y lo mete al pipeline automáticamente. Configurable con la información específica de tu gym.",
    precio: 399,
    planMinimo: "pro",
    estado: "proximamente",
    faseConstruccion: "Post Fase 8",
    iconName: "LuBot",
    beneficios: [
      "Atiende prospectos 24/7 sin intervención humana",
      "Responde FAQ configurables por gym",
      "Captura datos al pipeline automáticamente",
      "Funciona en WhatsApp y en tu landing web",
      "Reduce carga de recepción",
    ],
  },
  {
    id: "cfdi_facturacion",
    nombre: "CFDI Facturación",
    descripcionCorta: "Factura tus cobros con CFDI 4.0",
    descripcionLarga:
      "Emite facturas CFDI 4.0 timbradas ante el SAT directamente desde el sistema. Tus miembros piden su factura y se genera con los datos del cobro, sin capturar nada dos veces. Descarga de PDF y XML.",
    precio: 299,
    planMinimo: "pro",
    estado: "proximamente",
    faseConstruccion: "Próximamente",
    iconName: "LuFileText",
    beneficios: [
      "Facturación CFDI 4.0 timbrada ante el SAT",
      "Factura a partir del cobro registrado",
      "Descarga de PDF y XML",
      "Autoservicio de factura para el miembro",
      "Reduce trabajo manual de contabilidad",
    ],
  },
  {
    id: "multisucursal",
    nombre: "Multi-sucursal",
    descripcionCorta: "Gestiona varias sucursales en una cuenta",
    descripcionLarga:
      "Administra todas tus sucursales desde una sola cuenta: miembros, caja e inventario por sucursal, con reportes consolidados del negocio completo. Control de accesos por sucursal para tu equipo.",
    precio: 999,
    planMinimo: "escala",
    estado: "proximamente",
    faseConstruccion: "Próximamente",
    iconName: "LuBuilding2",
    beneficios: [
      "Varias sucursales en una sola cuenta",
      "Caja, miembros e inventario por sucursal",
      "Reportes consolidados del negocio",
      "Permisos de staff por sucursal",
      "Comparativos entre sucursales",
    ],
  },
];

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
