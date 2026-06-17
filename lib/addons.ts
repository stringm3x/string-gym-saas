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
  | "landing_dominio"
  | "ia_rutinas"
  | "chatbot_captacion"
  | "portal_miembro"
  | "acceso_qr"
  | "pasarela_pago"
  | "creditos_cxc";

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
    id: "landing_dominio",
    nombre: "Landing pública con dominio propio",
    descripcionCorta: "Tu propia página web con dominio personalizado",
    descripcionLarga:
      "Da a tu gimnasio una presencia profesional online. Página web con tus planes, horarios, ubicación y formulario que alimenta directamente tu pipeline de prospectos. Conecta tu propio dominio (ej. evolutiongym.com) sin pagar hosting aparte.",
    precio: 199,
    planMinimo: "basico",
    estado: "en_desarrollo",
    faseConstruccion: "Fase 7",
    iconName: "LuGlobe",
    beneficios: [
      "Página web profesional editable",
      "Dominio propio incluido (.com, .mx, etc.)",
      "Formulario web alimenta prospectos automáticamente",
      "Optimizada para móvil",
      "SEO básico configurado",
    ],
  },
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
    id: "portal_miembro",
    nombre: "Portal del miembro",
    descripcionCorta: "Auto-servicio para tus clientes",
    descripcionLarga:
      "Tus miembros entran a su propio portal para ver su membresía, historial de check-ins, rutinas asignadas. Pueden renovar membresía y obtener su QR de acceso. Reduce preguntas en recepción.",
    precio: 249,
    planMinimo: "pro",
    estado: "proximamente",
    faseConstruccion: "Futuro",
    iconName: "LuCircleUser",
    beneficios: [
      "Login propio para cada miembro",
      "Ven su historial y rutina",
      "Renuevan membresía solos",
      "Reduce preguntas en recepción",
      "Branding del gym",
    ],
  },
  {
    id: "acceso_qr",
    nombre: "Acceso por QR / huella",
    descripcionCorta: "Check-in automático sin recepcionista",
    descripcionLarga:
      "Lector QR o biométrico en la puerta del gym. Los miembros entran solos, sin necesidad de que alguien los busque en el sistema. Hardware se vende como kit aparte o lo proporciona el gym.",
    precio: 399,
    planMinimo: "basico",
    estado: "proximamente",
    faseConstruccion: "Futuro",
    iconName: "LuQrCode",
    beneficios: [
      "Check-in 100% automático",
      "Lector QR o biométrico en puerta",
      "No requiere recepcionista para acceso",
      "Tracking real de horarios de visita",
      "Hardware disponible como kit",
    ],
  },
  {
    id: "pasarela_pago",
    nombre: "Pasarela de pago integrada",
    descripcionCorta: "Cobra con tarjeta desde el sistema",
    descripcionLarga:
      "Integración con MercadoPago/Stripe. Cobra con tarjeta directamente desde Caja sin terminal externa. Genera links de pago para enviar por WhatsApp a clientes que pagan a distancia. Reduce manejo de efectivo.",
    precio: 349,
    planMinimo: "basico",
    estado: "proximamente",
    faseConstruccion: "Futuro",
    iconName: "LuCreditCard",
    beneficios: [
      "Cobra con tarjeta sin terminal externa",
      "Links de pago por WhatsApp",
      "Conciliación automática",
      "Reduce manejo de efectivo",
      "MercadoPago + Stripe",
    ],
  },
  {
    id: "creditos_cxc",
    nombre: "Créditos y cuentas por cobrar",
    descripcionCorta: "Para gyms que cobran a plazos",
    descripcionLarga:
      "Gestión de pagos diferidos: cargos, abonos parciales, saldo pendiente por miembro. Reporte de cuentas por cobrar. Alertas de WhatsApp para liquidación de saldos.",
    precio: 299,
    planMinimo: "pro",
    estado: "proximamente",
    faseConstruccion: "Cuando 2do cliente lo pida",
    iconName: "LuReceipt",
    beneficios: [
      "Tabla de cargos y abonos por miembro",
      "Saldo pendiente visible",
      "Reporte de cuentas por cobrar",
      "Alertas WhatsApp de liquidación",
      "Historial completo de cobros parciales",
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
