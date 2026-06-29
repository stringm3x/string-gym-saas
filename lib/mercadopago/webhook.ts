import type { NextRequest } from "next/server";
import { Payment, WebhookSignatureValidator } from "mercadopago";
import { getMpClient, getMpAccessToken } from "./client";

export type WebhookResult =
  | {
      ok: true;
      tenantId: string;
      paymentId: string;
      status: string;
      monto: number;
      metodo: string | null;
      externalReference: string | null;
    }
  | { ok: false; error: string };

/**
 * Verifica la firma del webhook de MercadoPago y obtiene el pago.
 *
 * - Firma: `WebhookSignatureValidator` con `MERCADOPAGO_WEBHOOK_SECRET` (secret
 *   global de la app). Tolerancia 5 min contra replay.
 * - Tenant: del query `?tenant=` que pusimos en el notification_url (sin OAuth
 *   no podríamos resolver a qué gym pertenece el pago de otra forma).
 * - Pago: se consulta con el access token del gym (Payment.get).
 *
 * El handler (Bloque 3) debe llamar esto solo para notificaciones de tipo
 * `payment` y manejar la idempotencia (no re-procesar si ya está approved).
 */
export async function verifyAndProcessWebhook(
  request: NextRequest
): Promise<WebhookResult> {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return { ok: false, error: "WEBHOOK_SECRET_FALTANTE" };

  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenant");
  const dataId =
    url.searchParams.get("data.id") ?? url.searchParams.get("id");

  // 1. Verificar firma.
  try {
    WebhookSignatureValidator.validate({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId,
      secret,
      toleranceSeconds: 300,
    });
  } catch {
    return { ok: false, error: "FIRMA_INVALIDA" };
  }

  if (!tenantId || !dataId) {
    return { ok: false, error: "DATOS_INCOMPLETOS" };
  }

  // 2. Token del gym para consultar el pago.
  const token = await getMpAccessToken(tenantId);
  if (!token) return { ok: false, error: "MP_NO_CONECTADO" };

  // 3. Obtener el pago desde MercadoPago.
  try {
    const pago = await new Payment(getMpClient(token)).get({ id: dataId });
    return {
      ok: true,
      tenantId,
      paymentId: String(pago.id ?? dataId),
      status: pago.status ?? "unknown",
      monto: pago.transaction_amount ?? 0,
      metodo: pago.payment_type_id ?? null,
      externalReference: pago.external_reference ?? null,
    };
  } catch {
    return { ok: false, error: "PAGO_NO_ENCONTRADO" };
  }
}
