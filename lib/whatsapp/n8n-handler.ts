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
  TEMPLATE_CAMPANA,
  TEMPLATE_LISTA_ESPERA,
  TEMPLATE_OTP,
  TEMPLATE_VISITAS_BAJAS,
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
      // {{1}} nombre · {{2}} días · {{3}} gym  (mismo orden que el workflow n8n)
      return {
        to: event.miembroTelefono ?? "",
        templateName: TEMPLATE_RECORDATORIO_VENCIMIENTO,
        params: [
          event.miembroNombre,
          String(event.diasRestantes),
          event.gymNombre,
        ],
        apiKey: event.whatsappApiKey,
      };

    case "MEMBRESIA_VENCIDA":
      // {{1}} nombre · {{2}} gym
      return {
        to: event.miembroTelefono ?? "",
        templateName: TEMPLATE_MEMBRESIA_VENCIDA,
        params: [event.miembroNombre, event.gymNombre],
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
      // Al OWNER, desde el número del gym.
      // {{1}} miembro · {{2}} días sin venir · {{3}} gym
      return {
        to: event.ownerTelefono ?? "",
        templateName: TEMPLATE_MIEMBRO_INACTIVO,
        params: [
          event.miembroNombre,
          String(event.diasSinVenir),
          event.gymNombre,
        ],
        apiKey: event.whatsappApiKey,
      };

    case "PROSPECTO_NUEVO":
      // Al owner, desde el número del gym. Si es la alerta de STRING a Carlos
      // (sin credenciales de gym) cae a la cuenta de STRING (DIALOG360_API_KEY).
      // {{1}} prospecto · {{2}} tel · {{3}} plan interés
      return {
        to: event.ownerTelefono ?? "",
        templateName: TEMPLATE_PROSPECTO_NUEVO,
        params: [
          event.prospectoNombre,
          event.prospectoTelefono ?? "",
          event.planInteres ?? "",
        ],
        apiKey: event.whatsappApiKey ?? stringKey,
      };

    case "RESUMEN_DIARIO":
      // Al owner, desde el número del gym.
      // {{1}} gym · {{2}} check-ins · {{3}} ingresos · {{4}} vencen semana
      return {
        to: event.ownerTelefono ?? "",
        templateName: TEMPLATE_RESUMEN_DIARIO,
        params: [
          event.gymNombre,
          String(event.checkinshoy),
          String(event.ingresosHoy),
          String(event.vencimientosEstaSemana),
        ],
        apiKey: event.whatsappApiKey,
      };

    case "CAMPANA":
      // Al miembro, desde el número del gym. {{1}} = mensaje ya compuesto.
      return {
        to: event.miembroTelefono ?? "",
        templateName: TEMPLATE_CAMPANA,
        params: [event.mensaje],
        apiKey: event.whatsappApiKey,
      };

    case "LISTA_ESPERA":
      // Al miembro. {{1}} nombre · {{2}} clase · {{3}} fecha · {{4}} hora
      return {
        to: event.miembroTelefono ?? "",
        templateName: TEMPLATE_LISTA_ESPERA,
        params: [
          event.miembroNombre,
          event.claseNombre,
          event.fecha,
          event.hora,
        ],
        apiKey: event.whatsappApiKey,
      };

    case "OTP":
      // Al miembro. {{1}} código.
      return {
        to: event.miembroTelefono ?? "",
        templateName: TEMPLATE_OTP,
        params: [event.codigo],
        apiKey: event.whatsappApiKey,
      };

    case "VISITAS_BAJAS":
      // Al miembro. {{1}} nombre · {{2}} visitas restantes.
      return {
        to: event.miembroTelefono ?? "",
        templateName: TEMPLATE_VISITAS_BAJAS,
        params: [event.miembroNombre, String(event.visitasRestantes)],
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
