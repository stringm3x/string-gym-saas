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
  | {
      ok: false;
      error: string;
      /** tenantId/dataId, cuando ya se alcanzaron a leer del query — para que
       * el caller pueda loguear a qué gym/pago corresponde un fallo que hoy
       * responde 200 (MP_NO_CONECTADO, PAGO_NO_ENCONTRADO, DATOS_INCOMPLETOS)
       * y de otro modo quedaría enterrado sin que nadie se entere. */
      tenantId?: string | null;
      dataId?: string | null;
    };

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
    return { ok: false, error: "DATOS_INCOMPLETOS", tenantId, dataId };
  }

  // 2. Token del gym para consultar el pago.
  const token = await getMpAccessToken(tenantId);
  if (!token) return { ok: false, error: "MP_NO_CONECTADO", tenantId, dataId };

  // 3. Obtener el pago desde MercadoPago.
  try {
    const pago = await new Payment(getMpClient(token)).get({ id: dataId });
    // TODO(bloque-03): quitar este log una vez confirmados con un checkout
    // real los valores de payment_type_id para tarjeta/OXXO/SPEI — mapMetodo
    // (route.ts) está construido sobre supuestos de la documentación, no
    // sobre datos observados. Si el mapeo está mal, los cobros entran al
    // corte en la categoría equivocada y el arqueo no cuadra.
    console.error(
      `[mp-webhook] payload crudo de Payment.get (para confirmar mapMetodo):`,
      JSON.stringify({
        id: pago.id,
        status: pago.status,
        payment_type_id: pago.payment_type_id,
        payment_method_id: pago.payment_method_id,
        transaction_amount: pago.transaction_amount,
        external_reference: pago.external_reference,
      })
    );
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
    return { ok: false, error: "PAGO_NO_ENCONTRADO", tenantId, dataId };
  }
}
