"use server";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePortal } from "@/lib/portal/session";
import { createCheckoutPreference } from "@/lib/mercadopago/preferences";

type RenovarResult =
  | { ok: true; initPoint: string }
  | { ok: false; error: string };

/**
 * Inicia la renovación de membresía del miembro con MercadoPago. Crea la fila
 * `pagos_externos` (pending) con miembroId+planId; el webhook existente
 * confirma el pago y extiende el vencimiento. Corre con service-role (el
 * miembro no tiene sesión de staff).
 */
export async function renovarMpAction(
  slug: string,
  planId: string
): Promise<RenovarResult> {
  const { gym, session } = await requirePortal(slug);
  const admin = createAdminClient();

  const { data: plan } = await admin
    .from("planes_membresia")
    .select("id, nombre, precio, activo")
    .eq("tenant_id", gym.id)
    .eq("id", planId)
    .maybeSingle();
  if (!plan || !plan.activo) {
    return { ok: false, error: "Ese plan no está disponible." };
  }

  const { data: miembro } = await admin
    .from("miembros")
    .select("email")
    .eq("tenant_id", gym.id)
    .eq("id", session.miembroId)
    .maybeSingle();

  const monto = Number(plan.precio);
  const refId = randomUUID();

  const { error: insErr } = await admin.from("pagos_externos").insert({
    tenant_id: gym.id,
    proveedor: "mercadopago",
    external_id: refId,
    status: "pending",
    monto,
    metadata: {
      descripcion: plan.nombre,
      miembroId: session.miembroId,
      planId: plan.id,
    },
  });
  if (insErr) return { ok: false, error: "No se pudo iniciar el pago." };

  const domain = process.env.APP_DOMAIN ?? "app.gym.stringwebs.com";
  const portalUrl = `https://${domain}/portal/${slug}`;

  const pref = await createCheckoutPreference(gym.id, {
    titulo: plan.nombre,
    monto,
    successUrl: portalUrl,
    failureUrl: portalUrl,
    pendingUrl: portalUrl,
    externalReference: refId,
    payerEmail: miembro?.email || undefined,
  });

  if (!pref.ok) {
    await admin
      .from("pagos_externos")
      .delete()
      .eq("tenant_id", gym.id)
      .eq("external_id", refId);
    return {
      ok: false,
      error:
        pref.error === "MP_NO_CONECTADO"
          ? "El gimnasio no tiene pagos en línea configurados."
          : pref.error,
    };
  }

  await admin
    .from("pagos_externos")
    .update({
      metadata: {
        descripcion: plan.nombre,
        miembroId: session.miembroId,
        planId: plan.id,
        preference_id: pref.id,
      },
    })
    .eq("tenant_id", gym.id)
    .eq("external_id", refId);

  return { ok: true, initPoint: pref.initPoint };
}
