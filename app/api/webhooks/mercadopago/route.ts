import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAndProcessWebhook } from "@/lib/mercadopago/webhook";
import { calcularRangoPorDias } from "@/lib/utils/membresia-rango";
import { createNotification } from "@/lib/utils/notifications";

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

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Revierte un pago de MercadoPago tras un reembolso o contracargo (B2c): marca
 * el pago reembolsado (deja de contar como ingreso), regresa la vigencia del
 * miembro a la fecha previa (periodo_inicio del pago) y refleja el estado.
 * Idempotente: si el pago ya está reembolsado, solo actualiza el estado.
 */
async function revertirPagoMp(
  admin: Admin,
  tenantId: string,
  ext: { id: string; pago_id: string | null },
  mpStatus: string
): Promise<void> {
  const motivo =
    mpStatus === "charged_back"
      ? "Contracargo MercadoPago"
      : "Reembolso MercadoPago";

  await admin
    .from("pagos_externos")
    .update({ status: mpStatus })
    .eq("id", ext.id);

  if (!ext.pago_id) return;

  const { data: pago } = await admin
    .from("pagos")
    .select("id, miembro_id, periodo_inicio, monto, reembolsado_at")
    .eq("tenant_id", tenantId)
    .eq("id", ext.pago_id)
    .maybeSingle();
  if (!pago || pago.reembolsado_at) return; // ya revertido

  await admin
    .from("pagos")
    .update({
      reembolsado_at: new Date().toISOString(),
      reembolsado_motivo: motivo,
    })
    .eq("tenant_id", tenantId)
    .eq("id", pago.id);

  // Revertir la vigencia a la fecha previa a este pago.
  if (pago.miembro_id && pago.periodo_inicio) {
    await admin
      .from("miembros")
      .update({ fecha_vencimiento: pago.periodo_inicio })
      .eq("tenant_id", tenantId)
      .eq("id", pago.miembro_id);
  }

  await createNotification(
    tenantId,
    "pago",
    `${motivo}: se revirtió un pago de $${Number(pago.monto).toLocaleString("es-MX")}`,
    undefined,
    "caja"
  );
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
    .select("id, status, monto, metadata, pago_id")
    .eq("tenant_id", result.tenantId)
    .eq("external_id", result.externalReference ?? "")
    .maybeSingle();

  // Fila no encontrada (race) → 200.
  if (!ext) return new NextResponse(null, { status: 200 });

  // Reversión post-aprobación (B2c): reembolso o contracargo de MP. Debe correr
  // ANTES del guard de idempotencia (ext ya está 'approved').
  if (
    ext.status === "approved" &&
    (result.status === "refunded" || result.status === "charged_back")
  ) {
    await revertirPagoMp(admin, result.tenantId, ext, result.status);
    return new NextResponse(null, { status: 200 });
  }

  // Idempotencia: ya aprobada → no re-procesar.
  if (ext.status === "approved") return new NextResponse(null, { status: 200 });

  const metadata = (ext.metadata ?? {}) as ExtMetadata;

  if (result.status === "approved") {
    const miembroId = metadata.miembroId ?? null;
    const planId = metadata.planId ?? null;

    // Si el cobro es de una membresía (miembro + plan), calcular el periodo
    // con la MISMA lógica del cobro manual (día de pago) para luego extender
    // el vencimiento del miembro. Sin miembro/plan → pago genérico (sin extensión).
    let periodoInicio: string | null = null;
    let periodoFin: string | null = null;
    if (miembroId && planId) {
      const [planRes, miembroRes] = await Promise.all([
        admin
          .from("planes_membresia")
          .select("dias_duracion")
          .eq("id", planId)
          .maybeSingle(),
        admin
          .from("miembros")
          .select("fecha_vencimiento")
          .eq("tenant_id", result.tenantId)
          .eq("id", miembroId)
          .maybeSingle(),
      ]);
      if (planRes.data?.dias_duracion) {
        const rango = calcularRangoPorDias(
          planRes.data.dias_duracion,
          miembroRes.data?.fecha_vencimiento
        );
        periodoInicio = rango.periodo_inicio;
        periodoFin = rango.periodo_fin;
      }
    }

    const { data: pago } = await admin
      .from("pagos")
      .insert({
        tenant_id: result.tenantId,
        miembro_id: miembroId,
        concepto: "membresia",
        monto: result.monto || Number(ext.monto),
        metodo_pago: mapMetodo(result.metodo),
        fecha_pago: new Date().toISOString(),
        plan_id: planId,
        periodo_inicio: periodoInicio,
        periodo_fin: periodoFin,
      })
      .select("id")
      .single();

    // Extender el vencimiento del miembro (paridad con el cobro manual).
    // Incluye el plan cobrado + saldo de visitas si el plan es por visitas (D3).
    if (miembroId && periodoFin) {
      const updatePayload: Record<string, unknown> = {
        fecha_vencimiento: periodoFin,
      };
      if (planId) {
        updatePayload.plan_id = planId;
        const { data: plan } = await admin
          .from("planes_membresia")
          .select("tipo, visitas")
          .eq("id", planId)
          .maybeSingle();
        updatePayload.visitas_restantes =
          plan?.tipo === "visitas" || plan?.tipo === "paquete"
            ? (plan?.visitas ?? null)
            : null;
      }
      await admin
        .from("miembros")
        .update(updatePayload)
        .eq("tenant_id", result.tenantId)
        .eq("id", miembroId);
    }

    await admin
      .from("pagos_externos")
      .update({
        status: "approved",
        metodo: result.metodo,
        pago_id: pago?.id ?? null,
      })
      .eq("id", ext.id);

    // Notificación in-app al gym (Fase 7.3).
    const montoPago = result.monto || Number(ext.monto);
    await createNotification(
      result.tenantId,
      "pago",
      `Pago confirmado con MercadoPago: $${montoPago.toLocaleString("es-MX")}`,
      undefined,
      "caja"
    );
  } else {
    // rejected / cancelled / pending (OXXO) / in_process … reflejar estado.
    await admin
      .from("pagos_externos")
      .update({ status: result.status, metodo: result.metodo })
      .eq("id", ext.id);
  }

  return new NextResponse(null, { status: 200 });
}
