/**
 * Modo B (directo, sin n8n) — Fase 7.5, Bloque 3.
 *
 * processWhatsappEvent traduce un WhatsappEvent a una llamada de 360dialog.
 * Solo actúa en Modo B: si hay N8N_WEBHOOK_URL, n8n ya lo cubrió (no-op); si no
 * hay DIALOG360_API_KEY, no hay infra directa (no-op).
 *
 * Los mensajes al miembro salen de la subcuenta del gym (event.whatsappApiKey).
 * Los mensajes al owner salen de la cuenta de STRING (DIALOG360_API_KEY).
 */
import type { WhatsappEvent } from "./types";
import {
  sendWhatsappMessage,
  type SendWhatsappParams,
  TEMPLATE_RECORDATORIO_VENCIMIENTO,
  TEMPLATE_MEMBRESIA_VENCIDA,
  TEMPLATE_PAGO_CONFIRMADO,
  TEMPLATE_BIENVENIDA,
  TEMPLATE_RESUMEN_DIARIO,
  TEMPLATE_PROSPECTO_NUEVO,
  TEMPLATE_MIEMBRO_INACTIVO,
} from "./360dialog";

function pesos(n: number): string {
  return `$${n.toLocaleString("es-MX")}`;
}

/**
 * Mapea un evento a su plantilla + parámetros. El orden de `params` define los
 * placeholders {{1}}, {{2}}, … de la plantilla en Meta (mismo contrato que los
 * workflows de n8n del Bloque 5).
 */
function traducir(event: WhatsappEvent): SendWhatsappParams | null {
  const stringKey = process.env.DIALOG360_API_KEY ?? null;

  switch (event.tipo) {
    case "MEMBRESIA_POR_VENCER":
      // {{1}} nombre · {{2}} gym · {{3}} días · {{4}} vencimiento
      return {
        to: event.miembroTelefono ?? "",
        templateName: TEMPLATE_RECORDATORIO_VENCIMIENTO,
        params: [
          event.miembroNombre,
          event.gymNombre,
          String(event.diasRestantes),
          event.fechaVencimiento,
        ],
        apiKey: event.whatsappApiKey,
      };

    case "MEMBRESIA_VENCIDA":
      // {{1}} nombre · {{2}} gym · {{3}} vencimiento
      return {
        to: event.miembroTelefono ?? "",
        templateName: TEMPLATE_MEMBRESIA_VENCIDA,
        params: [event.miembroNombre, event.gymNombre, event.fechaVencimiento],
        apiKey: event.whatsappApiKey,
      };

    case "PAGO_REGISTRADO":
      // {{1}} nombre · {{2}} monto · {{3}} plan · {{4}} vencimiento
      return {
        to: event.miembroTelefono ?? "",
        templateName: TEMPLATE_PAGO_CONFIRMADO,
        params: [
          event.miembroNombre,
          pesos(event.monto),
          event.planNombre,
          event.fechaVencimiento ?? "",
        ],
        apiKey: event.whatsappApiKey,
      };

    case "BIENVENIDA_MIEMBRO":
      // {{1}} nombre · {{2}} gym · {{3}} plan · {{4}} vencimiento
      return {
        to: event.miembroTelefono ?? "",
        templateName: TEMPLATE_BIENVENIDA,
        params: [
          event.miembroNombre,
          event.gymNombre,
          event.planNombre,
          event.fechaVencimiento,
        ],
        apiKey: event.whatsappApiKey,
      };

    case "MIEMBRO_SIN_ACTIVIDAD":
      // Al OWNER, desde el número del gym. Incluye el tel del miembro para que
      // el owner pueda contactarlo.
      // {{1}} miembro · {{2}} tel miembro · {{3}} gym · {{4}} días sin venir
      return {
        to: event.ownerTelefono ?? "",
        templateName: TEMPLATE_MIEMBRO_INACTIVO,
        params: [
          event.miembroNombre,
          event.miembroTelefono ?? "",
          event.gymNombre,
          String(event.diasSinVenir),
        ],
        apiKey: event.whatsappApiKey,
      };

    case "PROSPECTO_NUEVO":
      // Al owner, desde el número del gym. Si es la alerta de STRING a Carlos
      // (sin credenciales de gym) cae a la cuenta de STRING (DIALOG360_API_KEY).
      // {{1}} prospecto · {{2}} tel · {{3}} plan interés · {{4}} gym
      return {
        to: event.ownerTelefono ?? "",
        templateName: TEMPLATE_PROSPECTO_NUEVO,
        params: [
          event.prospectoNombre,
          event.prospectoTelefono ?? "",
          event.planInteres ?? "",
          event.gymNombre,
        ],
        apiKey: event.whatsappApiKey ?? stringKey,
      };

    case "RESUMEN_DIARIO":
      // Al owner, desde el número del gym.
      // {{1}} gym · {{2}} check-ins · {{3}} ingresos · {{4}} vencen semana · {{5}} prospectos
      return {
        to: event.ownerTelefono ?? "",
        templateName: TEMPLATE_RESUMEN_DIARIO,
        params: [
          event.gymNombre,
          String(event.checkinshoy),
          pesos(event.ingresosHoy),
          String(event.vencimientosEstaSemana),
          String(event.prospectosPendientes),
        ],
        apiKey: event.whatsappApiKey,
      };
  }
}

/**
 * Procesa un evento en Modo B (360dialog directo). No-op si estamos en Modo A
 * (n8n) o si no hay credencial directa.
 */
export async function processWhatsappEvent(
  event: WhatsappEvent
): Promise<void> {
  if (process.env.N8N_WEBHOOK_URL) return; // Modo A: n8n ya lo cubrió
  if (!process.env.DIALOG360_API_KEY) return; // Modo B no habilitado

  const msg = traducir(event);
  if (!msg || !msg.to) return;
  await sendWhatsappMessage(msg);
}
