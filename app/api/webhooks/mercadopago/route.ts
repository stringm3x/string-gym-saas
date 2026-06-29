import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAndProcessWebhook } from "@/lib/mercadopago/webhook";

export const runtime = "nodejs";

/** Mapea el payment_type_id de MP al metodo_pago interno del gym. */
function mapMetodo(tipo: string | null): string {
  if (!tipo) return "transferencia";
  if (tipo.includes("card")) return "tarjeta"; // credit/debit/prepaid_card
  if (tipo === "ticket") return "efectivo"; // OXXO
  return "transferencia"; // bank_transfer (SPEI), account_money, etc.
}

interface ExtMetadata {
  miembroId?: string | null;
  planId?: string | null;
  descripcion?: string;
}

/**
 * Webhook público de MercadoPago. Verifica la firma, obtiene el pago y
 * confirma/actualiza la fila de pagos_externos. Siempre responde 200 salvo
 * firma inválida (401), para que MP no reintente sobre errores irrecuperables.
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? url.searchParams.get("topic");

  // Solo notificaciones de pago; el resto se ignora silenciosamente.
  if (type && type !== "payment") {
    return new NextResponse(null, { status: 200 });
  }

  const result = await verifyAndProcessWebhook(request);
  if (!result.ok) {
    if (result.error === "FIRMA_INVALIDA") {
      return new NextResponse(null, { status: 401 });
    }
    // race / gym desconectado / pago no encontrado → 200 (no reintentar).
    return new NextResponse(null, { status: 200 });
  }

  const admin = createAdminClient();
  const { data: ext } = await admin
    .from("pagos_externos")
    .select("id, status, monto, metadata")
    .eq("tenant_id", result.tenantId)
    .eq("external_id", result.externalReference ?? "")
    .maybeSingle();

  // Fila no encontrada (race) → 200.
  if (!ext) return new NextResponse(null, { status: 200 });
  // Idempotencia: ya aprobada → no re-procesar.
  if (ext.status === "approved") return new NextResponse(null, { status: 200 });

  const metadata = (ext.metadata ?? {}) as ExtMetadata;

  if (result.status === "approved") {
    const { data: pago } = await admin
      .from("pagos")
      .insert({
        tenant_id: result.tenantId,
        miembro_id: metadata.miembroId ?? null,
        concepto: "membresia",
        monto: result.monto || Number(ext.monto),
        metodo_pago: mapMetodo(result.metodo),
        fecha_pago: new Date().toISOString(),
        plan_id: metadata.planId ?? null,
      })
      .select("id")
      .single();

    await admin
      .from("pagos_externos")
      .update({
        status: "approved",
        metodo: result.metodo,
        pago_id: pago?.id ?? null,
      })
      .eq("id", ext.id);
  } else {
    // rejected / cancelled / pending (OXXO) / in_process … reflejar estado.
    await admin
      .from("pagos_externos")
      .update({ status: result.status, metodo: result.metodo })
      .eq("id", ext.id);
  }

  return new NextResponse(null, { status: 200 });
}
