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
import { normalizarTelefonoMx } from "@/lib/utils/whatsapp";

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
 * Devuelve el evento con el teléfono destino normalizado a E.164 MX. Los
 * eventos se arman con `miembro.telefono`/`gym.telefono` tal como se
 * guardan (10 dígitos, sin lada); tanto el POST a n8n (cuyo workflow reenvía
 * ese valor a 360dialog sin tocarlo, ver docs/n8n-workflows) como el envío
 * directo (n8n-handler.ts → 360dialog.ts) necesitan el número completo.
 */
function conDestinoNormalizado(event: WhatsappEvent, numero: string): WhatsappEvent {
  switch (event.tipo) {
    case "PROSPECTO_NUEVO":
    case "RESUMEN_DIARIO":
    case "MIEMBRO_SIN_ACTIVIDAD":
      return { ...event, ownerTelefono: numero };
    default:
      return { ...event, miembroTelefono: numero };
  }
}

/**
 * Dispara una notificación de WhatsApp. Fire-and-forget: nunca lanza; no-op si
 * no hay destinatario ni infra configurada. Devuelve true si el envío (o el
 * POST al webhook de n8n) se aceptó, false si falló — los llamadores
 * fire-and-forget (`void notifyWhatsapp(...)`) pueden seguir ignorándolo, pero
 * los que necesitan saber si realmente salió (ej. campañas) ahora sí pueden.
 */
export async function notifyWhatsapp(event: WhatsappEvent): Promise<boolean> {
  const destino = destinoDe(event);
  if (!destino) return false; // sin destinatario → nada que enviar
  const eventoNormalizado = conDestinoNormalizado(event, normalizarTelefonoMx(destino));

  const webhook = process.env.N8N_WEBHOOK_URL;
  if (webhook) {
    // Modo A: n8n orquesta. "Éxito" aquí es que el webhook aceptó el POST —
    // la entrega real la resuelve n8n de forma asíncrona.
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventoNormalizado),
      });
      return res.ok;
    } catch (err) {
      console.error(`[whatsapp] notify (n8n) falló (${event.tipo}):`, err);
      return false;
    }
  }

  // Modo B: 360dialog directo (o no-op si tampoco hay DIALOG360_API_KEY).
  return processWhatsappEvent(eventoNormalizado);
}
