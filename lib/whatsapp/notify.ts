/**
 * Motor de notificaciones WhatsApp (Fase 7.5).
 *
 * `notifyWhatsapp` es el único punto de entrada. Enruta según la infra:
 *  - Modo A (n8n): si `N8N_WEBHOOK_URL` está → POST fire-and-forget al webhook
 *    de n8n, que orquesta el envío por 360dialog.
 *  - Modo B (directo): si no hay n8n → delega en processWhatsappEvent, que
 *    llama a 360dialog directamente (usa `DIALOG360_API_KEY`).
 *  - Si ninguna infra está configurada → NO-OP silencioso.
 *
 * Nunca lanza: una notificación jamás debe romper un cobro, una inscripción,
 * ni el cron.
 */
import type { WhatsappEvent } from "./types";
import { processWhatsappEvent } from "./n8n-handler";

export type { WhatsappEvent } from "./types";

/** Teléfono destino del evento (miembro o owner según el tipo). */
function destinoDe(event: WhatsappEvent): string | null {
  switch (event.tipo) {
    case "PROSPECTO_NUEVO":
    case "RESUMEN_DIARIO":
    case "MIEMBRO_SIN_ACTIVIDAD":
      return event.ownerTelefono;
    default:
      return event.miembroTelefono;
  }
}

/**
 * Dispara una notificación de WhatsApp. Fire-and-forget: nunca lanza; no-op si
 * no hay destinatario ni infra configurada.
 */
export async function notifyWhatsapp(event: WhatsappEvent): Promise<void> {
  if (!destinoDe(event)) return; // sin destinatario → nada que enviar

  const webhook = process.env.N8N_WEBHOOK_URL;
  if (webhook) {
    // Modo A: n8n orquesta.
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
    } catch (err) {
      console.error(`[whatsapp] notify (n8n) falló (${event.tipo}):`, err);
    }
    return;
  }

  // Modo B: 360dialog directo (o no-op si tampoco hay DIALOG360_API_KEY).
  await processWhatsappEvent(event);
}
