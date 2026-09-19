import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAndProcessWebhook } from "@/lib/mercadopago/webhook";
import { calcularRangoPorDias } from "@/lib/utils/membresia-rango";
import { createNotification } from "@/lib/utils/notifications";
import { generarTokenRecibo } from "@/lib/utils/tokens";
import { registrarCajaDePagos } from "@/lib/queries/pagos.queries";

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
 * Log visible para los casos que responden 200 (reintentar no los arregla)
 * pero que igual necesitan que alguien se entere: MP_NO_CONECTADO en
 * particular significa que un socio ya pagó y el gym no tiene credenciales
 * para recibirlo — ese dinero queda en el limbo si esto queda enterrado.
 * Solo va a logs de servidor por ahora (no hay aviso in-app en esta rama).
 */
async function logWebhookSilencioso(
  admin: Admin,
  motivo: string,
  detalle: { tenantId?: string | null; dataId?: string | null }
): Promise<void> {
  let gym = detalle.tenantId ?? "?";
  if (detalle.tenantId) {
    const { data } = await admin
      .from("gyms")
      .select("slug")
      .eq("id", detalle.tenantId)
      .maybeSingle();
    if (data?.slug) gym = data.slug as string;
  }
  console.error(
    `[mp-webhook] ${motivo} — gym=${gym} mp_payment_id=${detalle.dataId ?? "?"}`
  );
}

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
 * confirma/actualiza la fila de pagos_externos. Responde 401 con firma
 * inválida, 500 si falta configurar el secreto o si falla confirmar el pago
 * (para que MP reintente — un cobro real no debe quedar sin registrar sin
 * que nadie se entere) y 200 en el resto de los casos (incluyendo los que
 * no tiene sentido reintentar: tipo de notificación ignorado, fila no
 * encontrada, gym sin MP conectado, pago no encontrado en MP).
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? url.searchParams.get("topic");

  // Solo notificaciones de pago; el resto se ignora silenciosamente.
  if (type && type !== "payment") {
    return new NextResponse(null, { status: 200 });
  }

  const admin = createAdminClient();

  const result = await verifyAndProcessWebhook(request);
  if (!result.ok) {
    if (result.error === "FIRMA_INVALIDA") {
      return new NextResponse(null, { status: 401 });
    }
    if (result.error === "WEBHOOK_SECRET_FALTANTE") {
      // Falla de configuración del servidor, no del webhook en sí — MP debe
      // reintentar. Con 200 aquí, un cobro real ya aprobado por MP se
      // quedaría sin registrar para siempre y sin que nadie se entere.
      console.error(
        "[mp-webhook] MERCADOPAGO_WEBHOOK_SECRET no configurado; rechazando con 500 para que MP reintente."
      );
      return new NextResponse(null, { status: 500 });
    }
    // DATOS_INCOMPLETOS / MP_NO_CONECTADO / PAGO_NO_ENCONTRADO: el código de
    // respuesta se queda en 200 — reintentar no arregla ninguno de los tres
    // (el request sigue incompleto, el gym sigue sin MP conectado, o MP
    // sigue sin encontrar ese pago). Pero silencioso no es lo mismo que sin
    // consecuencia: MP_NO_CONECTADO en particular puede significar que el
    // socio ya pagó y el gym no tiene cómo recibirlo — sin este log, un 200
    // lo enterraba sin que nadie se enterara.
    await logWebhookSilencioso(admin, result.error, {
      tenantId: result.tenantId,
      dataId: result.dataId,
    });
    return new NextResponse(null, { status: 200 });
  }

  const { data: ext } = await admin
    .from("pagos_externos")
    .select("id, status, monto, metadata, pago_id")
    .eq("tenant_id", result.tenantId)
    .eq("proveedor", "mercadopago")
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

    // Confirmación atómica (sql/067): registrar_pago (mismo RPC del cobro
    // manual — stock/membresía/visitas en una sola transacción) + marcar
    // pagos_externos como aprobado, los dos o ninguno. Antes era un insert
    // directo en `pagos` sin pasar por el RPC ni por pagos_caja, sin checar
    // errores, con el guard de idempotencia separado del insert — dos
    // entregas casi simultáneas del webhook (MP sí las manda) podían crear
    // dos pagos para un solo cobro real.
    const montoPago = result.monto || Number(ext.monto);
    const metodoPago = mapMetodo(result.metodo);
    const { data: pagoId, error: confirmError } = await admin.rpc(
      "confirmar_pago_externo",
      {
        p_pagos_externos_id: ext.id,
        p_tenant_id: result.tenantId,
        p_monto: montoPago,
        p_metodo_pago: metodoPago,
        p_token: generarTokenRecibo(),
        p_miembro_id: miembroId,
        p_periodo_inicio: periodoInicio,
        p_periodo_fin: periodoFin,
        p_plan_id: planId,
      }
    );

    if (confirmError || !pagoId) {
      console.error(
        `[mp-webhook] no se pudo confirmar el pago externo ${ext.id} (tenant ${result.tenantId}):`,
        confirmError?.message
      );
      // MP debe reintentar: el cobro ya es real en su lado, pero no quedó
      // registrado de nuestro lado. Con 200 aquí, MP no vuelve a avisar y
      // el pago se queda pending para siempre sin que nadie se entere.
      return new NextResponse(null, { status: 500 });
    }

    // Enlace a caja: sin punto de venta físico, cae en la caja default del
    // gym — best-effort, igual que cualquier otro cobro sin caja explícita
    // (createPago). El pago ya se registró de verdad arriba; si esto falla
    // no se revierte, pero queda log visible (mismo criterio que en caja
    // presencial: un gym sin caja default no debe bloquear el cobro).
    await registrarCajaDePagos(admin, result.tenantId, [pagoId as string]);

    // Notificación in-app al gym (Fase 7.3).
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
