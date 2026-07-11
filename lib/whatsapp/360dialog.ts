/**
 * Cliente HTTP de 360dialog (WhatsApp Business API) — Fase 7.5, Bloque 3.
 *
 * `sendWhatsappMessage` envía un mensaje de plantilla. No-op silencioso si no
 * hay apiKey; nunca lanza (loguea el error). Timeout de 10s.
 */

// Nombres de las plantillas aprobadas en Meta (deben existir en la cuenta WABA).
export const TEMPLATE_RECORDATORIO_VENCIMIENTO = "recordatorio_vencimiento";
export const TEMPLATE_MEMBRESIA_VENCIDA = "membresia_vencida";
export const TEMPLATE_PAGO_CONFIRMADO = "pago_confirmado";
export const TEMPLATE_BIENVENIDA = "bienvenida_miembro";
export const TEMPLATE_RESUMEN_DIARIO = "resumen_diario_owner";
export const TEMPLATE_PROSPECTO_NUEVO = "prospecto_nuevo_owner";
export const TEMPLATE_MIEMBRO_INACTIVO = "miembro_inactivo_owner";

const ENDPOINT = "https://waba.360dialog.io/v1/messages";
const TIMEOUT_MS = 10_000;

export interface SendWhatsappParams {
  /** Número destino en E.164 (+521XXXXXXXXXX). */
  to: string;
  /** Nombre de la plantilla aprobada en Meta. */
  templateName: string;
  /** Parámetros del body de la plantilla ({{1}}, {{2}}, …) en orden. */
  params: string[];
  /** API key de la subcuenta 360dialog (del gym, o de STRING para el owner). */
  apiKey: string | null;
}

export async function sendWhatsappMessage(
  p: SendWhatsappParams
): Promise<void> {
  if (!p.apiKey || !p.to) return; // sin credencial o destino → no-op

  const body = {
    messaging_product: "whatsapp",
    to: p.to,
    type: "template",
    template: {
      name: p.templateName,
      language: { code: "es_MX" },
      components: [
        {
          type: "body",
          parameters: p.params.map((text) => ({ type: "text", text })),
        },
      ],
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "D360-API-KEY": p.apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      console.error(
        `[360dialog] ${res.status} (${p.templateName}):`,
        detalle.slice(0, 300)
      );
    }
  } catch (err) {
    console.error(`[360dialog] fallo al enviar ${p.templateName}:`, err);
  } finally {
    clearTimeout(timer);
  }
}
