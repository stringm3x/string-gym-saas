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
// Plantilla de marketing para campañas (B6): un solo parámetro con el mensaje
// ya compuesto ({{1}}). Debe existir aprobada en Meta.
export const TEMPLATE_CAMPANA = "campana";
// Lista de espera (C2): {{1}} nombre · {{2}} clase · {{3}} fecha · {{4}} hora.
export const TEMPLATE_LISTA_ESPERA = "lista_espera";
// OTP del portal (C3): {{1}} código de acceso.
export const TEMPLATE_OTP = "otp_portal";
// Visitas bajas (D8): {{1}} nombre · {{2}} visitas restantes.
export const TEMPLATE_VISITAS_BAJAS = "visitas_bajas";

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

  await postMessage(body, p.apiKey, p.templateName);
}

/**
 * Envía un mensaje de TEXTO LIBRE (no plantilla). Válido dentro de la ventana
 * de conversación de 24h — se usa para las respuestas del bot. No-op sin apiKey;
 * nunca lanza.
 */
export async function sendWhatsappText(
  to: string,
  body: string,
  apiKey: string | null
): Promise<boolean> {
  if (!apiKey || !to || !body.trim()) return false;
  return postMessage(
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    },
    apiKey,
    "text"
  );
}

/**
 * POST compartido a 360dialog con timeout y logging; nunca lanza. Devuelve
 * true si 360dialog respondió 2xx, false en cualquier otro caso.
 */
async function postMessage(
  body: unknown,
  apiKey: string,
  etiqueta: string
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "D360-API-KEY": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      console.error(`[360dialog] ${res.status} (${etiqueta}):`, detalle.slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[360dialog] fallo al enviar ${etiqueta}:`, err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
