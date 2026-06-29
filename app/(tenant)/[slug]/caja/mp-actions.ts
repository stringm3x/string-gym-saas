"use server";

import { randomUUID } from "node:crypto";
import { getTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { hasFeature } from "@/lib/features";
import { createClient } from "@/lib/supabase/server";
import { checkoutMpSchema } from "@/lib/validations/mercadopago.schema";
import { createCheckoutPreference } from "@/lib/mercadopago/preferences";

export type CobroMpResult =
  | { ok: true; initPoint: string }
  | { ok: false; error: string };

/**
 * Genera un link de cobro con MercadoPago (Checkout Pro). Crea la fila
 * `pagos_externos` en estado 'pending' (el webhook la confirma) y devuelve el
 * init_point para abrir el checkout.
 */
export async function crearCobroMpAction(input: unknown): Promise<CobroMpResult> {
  const tenant = await getTenant();
  if (
    !hasPermission(tenant.role, "registrar_pagos") ||
    !hasFeature(tenant.plan, "mercadopago")
  ) {
    return { ok: false, error: "No autorizado." };
  }

  const parsed = checkoutMpSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const v = parsed.data;

  const supabase = await createClient();
  // Referencia interna: external_id de pagos_externos = external_reference de
  // la preferencia. El webhook la usa para encontrar la fila y confirmar.
  const refId = randomUUID();

  const { error: insErr } = await supabase.from("pagos_externos").insert({
    tenant_id: tenant.id,
    proveedor: "mercadopago",
    external_id: refId,
    status: "pending",
    monto: v.monto,
    metadata: {
      descripcion: v.titulo,
      miembroId: v.miembroId ?? null,
      planId: v.planId ?? null,
    },
  });
  if (insErr) return { ok: false, error: insErr.message };

  const domain = process.env.APP_DOMAIN;
  const cajaUrl = domain
    ? `https://${domain}/${tenant.slug}/caja`
    : `https://app.gym.stringwebs.com/${tenant.slug}/caja`;

  const pref = await createCheckoutPreference(tenant.id, {
    titulo: v.titulo,
    monto: v.monto,
    successUrl: cajaUrl,
    failureUrl: cajaUrl,
    pendingUrl: cajaUrl,
    externalReference: refId,
    payerEmail: v.payerEmail || undefined,
  });

  if (!pref.ok) {
    // Limpia la fila pending si MP falló.
    await supabase
      .from("pagos_externos")
      .delete()
      .eq("tenant_id", tenant.id)
      .eq("external_id", refId);
    return {
      ok: false,
      error:
        pref.error === "MP_NO_CONECTADO"
          ? "Conecta MercadoPago en Configuración → Pagos."
          : pref.error,
    };
  }

  // Guarda el preference_id en metadata (referencia).
  await supabase
    .from("pagos_externos")
    .update({
      metadata: {
        descripcion: v.titulo,
        miembroId: v.miembroId ?? null,
        planId: v.planId ?? null,
        preference_id: pref.id,
      },
    })
    .eq("tenant_id", tenant.id)
    .eq("external_id", refId);

  return { ok: true, initPoint: pref.initPoint };
}
