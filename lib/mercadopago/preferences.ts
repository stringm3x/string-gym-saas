import { Preference } from "mercadopago";
import { getMpClient, getMpAccessToken } from "./client";

export interface CheckoutData {
  /** Descripción del item (ej. "Membresía Plan Mensual - CrossFit Norte"). */
  titulo: string;
  monto: number;
  cantidad?: number;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  /** Referencia interna (ej. id de pagos_externos) — vuelve en el webhook. */
  externalReference?: string;
  payerEmail?: string;
}

export type CreatePreferenceResult =
  | { ok: true; id: string; initPoint: string }
  | { ok: false; error: string };

/** URL del webhook (incluye el tenant para resolverlo sin OAuth). */
function notificationUrl(tenantId: string): string | undefined {
  const domain = process.env.APP_DOMAIN;
  if (!domain) return undefined;
  return `https://${domain}/api/webhooks/mercadopago?tenant=${tenantId}`;
}

/**
 * Crea una preferencia de Checkout Pro/Bricks para el gym. No excluye métodos:
 * quedan activos tarjeta, OXXO (ticket) y SPEI (bank_transfer) según la cuenta.
 */
export async function createCheckoutPreference(
  tenantId: string,
  data: CheckoutData
): Promise<CreatePreferenceResult> {
  const token = await getMpAccessToken(tenantId);
  if (!token) return { ok: false, error: "MP_NO_CONECTADO" };

  const preference = new Preference(getMpClient(token));

  try {
    const res = await preference.create({
      body: {
        items: [
          {
            id: data.externalReference ?? "membresia",
            title: data.titulo,
            quantity: data.cantidad ?? 1,
            unit_price: data.monto,
            currency_id: "MXN",
          },
        ],
        back_urls: {
          success: data.successUrl,
          failure: data.failureUrl,
          pending: data.pendingUrl,
        },
        auto_return: "approved",
        external_reference: data.externalReference,
        notification_url: notificationUrl(tenantId),
        ...(data.payerEmail ? { payer: { email: data.payerEmail } } : {}),
      },
    });

    if (!res.id || !res.init_point) {
      return { ok: false, error: "No se pudo crear la preferencia de pago." };
    }
    return { ok: true, id: String(res.id), initPoint: res.init_point };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error de MercadoPago.",
    };
  }
}
