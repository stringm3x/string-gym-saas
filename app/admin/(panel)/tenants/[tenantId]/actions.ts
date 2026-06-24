"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/admin/helpers";
import { ADDONS_CATALOG } from "@/lib/addons";
import {
  cambiarPlanSchema,
  suspenderSchema,
  cancelarSchema,
  extenderPruebaSchema,
  registrarPagoSchema,
  notaSchema,
} from "@/lib/validations/admin.schema";
import type { StringAdmin } from "@/lib/types/admin";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** Gate: devuelve el admin activo o null. */
async function gate(): Promise<StringAdmin | null> {
  return getCurrentAdmin();
}

/** Registra el evento en el audit log (vía RPC con la sesión del admin). */
async function logEvent(
  accion: string,
  tenantId: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("log_admin_event", {
    p_accion: accion,
    p_target_tenant_id: tenantId,
    p_target_user_id: null,
    p_metadata: metadata,
  });
}

function revalidate(tenantId: string) {
  revalidatePath(`/admin/tenants/${tenantId}`);
}

const DENIED: ActionResult = { ok: false, error: "Acceso denegado." };

// ─────────────────────────── Plan / fundador ───────────────────────────

export async function cambiarPlanAction(
  tenantId: string,
  input: { plan: string; motivo?: string }
): Promise<ActionResult> {
  if (!(await gate())) return DENIED;
  const parsed = cambiarPlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("gyms")
    .update({ plan: parsed.data.plan })
    .eq("id", tenantId);
  if (error) return { ok: false, error: error.message };

  await logEvent("tenant.cambiar_plan", tenantId, {
    plan: parsed.data.plan,
    motivo: parsed.data.motivo ?? null,
  });
  revalidate(tenantId);
  return { ok: true };
}

export async function marcarFundadorAction(
  tenantId: string,
  esFundador: boolean
): Promise<ActionResult> {
  if (!(await gate())) return DENIED;

  const admin = createAdminClient();
  const { error } = await admin
    .from("gyms")
    .update({
      es_fundador: esFundador,
      fundador_desde: esFundador ? new Date().toISOString() : null,
    })
    .eq("id", tenantId);
  if (error) return { ok: false, error: error.message };

  await logEvent("tenant.marcar_fundador", tenantId, { es_fundador: esFundador });
  revalidate(tenantId);
  return { ok: true };
}

// ─────────────────────────── Estado del tenant ───────────────────────────

export async function suspenderTenantAction(
  tenantId: string,
  motivo: string
): Promise<ActionResult> {
  if (!(await gate())) return DENIED;
  const parsed = suspenderSchema.safeParse({ motivo });
  if (!parsed.success) {
    return { ok: false, error: "Indica un motivo de suspensión." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("gyms")
    .update({
      estado: "suspendido",
      suspendido_at: new Date().toISOString(),
      suspension_motivo: parsed.data.motivo,
    })
    .eq("id", tenantId);
  if (error) return { ok: false, error: error.message };

  await logEvent("tenant.suspender", tenantId, { motivo: parsed.data.motivo });
  revalidate(tenantId);
  return { ok: true };
}

export async function reactivarTenantAction(
  tenantId: string
): Promise<ActionResult> {
  if (!(await gate())) return DENIED;

  const admin = createAdminClient();
  const { error } = await admin
    .from("gyms")
    .update({
      estado: "activo",
      suspendido_at: null,
      suspension_motivo: null,
    })
    .eq("id", tenantId);
  if (error) return { ok: false, error: error.message };

  await logEvent("tenant.reactivar", tenantId);
  revalidate(tenantId);
  return { ok: true };
}

export async function cancelarTenantAction(
  tenantId: string,
  input: { motivo: string; exportar: boolean }
): Promise<ActionResult> {
  if (!(await gate())) return DENIED;
  const parsed = cancelarSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Indica un motivo de cancelación." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("gyms")
    .update({
      estado: "cancelado",
      suspendido_at: new Date().toISOString(),
      suspension_motivo: parsed.data.motivo,
    })
    .eq("id", tenantId);
  if (error) return { ok: false, error: error.message };

  await logEvent("tenant.cancelar", tenantId, {
    motivo: parsed.data.motivo,
    // El export real se construye después; aquí solo se deja registro.
    exportar_datos_pendiente: parsed.data.exportar,
  });
  revalidate(tenantId);
  return { ok: true };
}

export async function extenderPruebaAction(
  tenantId: string,
  dias: number
): Promise<ActionResult> {
  if (!(await gate())) return DENIED;
  const parsed = extenderPruebaSchema.safeParse({ dias });
  if (!parsed.success) return { ok: false, error: "Número de días inválido." };

  const admin = createAdminClient();
  const { data: gym } = await admin
    .from("gyms")
    .select("estado, prueba_hasta")
    .eq("id", tenantId)
    .maybeSingle();

  if (!gym) return { ok: false, error: "Tenant no encontrado." };
  if (gym.estado !== "prueba") {
    return { ok: false, error: "El tenant no está en prueba." };
  }

  // Extiende desde la fecha de fin actual si es futura, si no desde hoy.
  const base =
    gym.prueba_hasta && new Date(gym.prueba_hasta) > new Date()
      ? new Date(gym.prueba_hasta)
      : new Date();
  base.setDate(base.getDate() + parsed.data.dias);
  const nuevaFecha = base.toISOString();

  const { error } = await admin
    .from("gyms")
    .update({ prueba_hasta: nuevaFecha })
    .eq("id", tenantId);
  if (error) return { ok: false, error: error.message };

  await logEvent("tenant.extender_prueba", tenantId, {
    dias: parsed.data.dias,
    prueba_hasta: nuevaFecha,
  });
  revalidate(tenantId);
  return { ok: true };
}

// ─────────────────────────── Add-ons ───────────────────────────

export async function toggleAddonAction(
  tenantId: string,
  addonId: string,
  activo: boolean
): Promise<ActionResult> {
  if (!(await gate())) return DENIED;

  const def = ADDONS_CATALOG.find((a) => a.id === addonId);
  if (!def) return { ok: false, error: "Add-on desconocido." };

  const admin = createAdminClient();
  if (activo) {
    const { error } = await admin.from("gym_addons").upsert(
      {
        tenant_id: tenantId,
        addon_id: addonId,
        estado: "activo",
        fecha_activacion: new Date().toISOString(),
        fecha_cancelacion: null,
        precio_actual: def.precio,
      },
      { onConflict: "tenant_id,addon_id" }
    );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin
      .from("gym_addons")
      .update({
        estado: "cancelado",
        fecha_cancelacion: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("addon_id", addonId);
    if (error) return { ok: false, error: error.message };
  }

  await logEvent("tenant.toggle_addon", tenantId, { addon_id: addonId, activo });
  revalidate(tenantId);
  return { ok: true };
}

// ─────────────────────────── Owner ───────────────────────────

export async function resetPasswordOwnerAction(
  tenantId: string
): Promise<ActionResult> {
  if (!(await gate())) return DENIED;

  const admin = createAdminClient();
  const { data: gym } = await admin
    .from("gyms")
    .select("owner_id")
    .eq("id", tenantId)
    .maybeSingle();
  if (!gym?.owner_id) return { ok: false, error: "Owner no encontrado." };

  const { data: u } = await admin.auth.admin.getUserById(gym.owner_id);
  const email = u?.user?.email;
  if (!email) return { ok: false, error: "El owner no tiene email." };

  const supabase = await createClient();
  const redirectTo = process.env.APP_DOMAIN
    ? `https://${process.env.APP_DOMAIN}/login`
    : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) return { ok: false, error: error.message };

  await logEvent("tenant.reset_password_owner", tenantId, { email });
  return { ok: true };
}

// ─────────────────────────── Pagos manuales ───────────────────────────

export async function registrarPagoManualAction(
  tenantId: string,
  input: {
    concepto: string;
    monto: number;
    metodo: string;
    fecha_pago: string;
    referencia?: string;
    notas?: string;
  }
): Promise<ActionResult> {
  const admin = await gate();
  if (!admin) return DENIED;
  const parsed = registrarPagoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos del pago inválidos." };

  const sb = createAdminClient();
  const { error } = await sb.from("admin_tenant_pagos").insert({
    tenant_id: tenantId,
    concepto: parsed.data.concepto,
    monto: parsed.data.monto,
    metodo: parsed.data.metodo,
    fecha_pago: parsed.data.fecha_pago,
    referencia: parsed.data.referencia ?? null,
    notas: parsed.data.notas ?? null,
    admin_user_id: admin.user_id,
    admin_email: admin.email,
  });
  if (error) {
    return {
      ok: false,
      error:
        "No se pudo registrar el pago. ¿Aplicaste la migración 023? (" +
        error.message +
        ")",
    };
  }

  await logEvent("tenant.pago_manual", tenantId, {
    concepto: parsed.data.concepto,
    monto: parsed.data.monto,
  });
  revalidate(tenantId);
  return { ok: true };
}

// ─────────────────────────── Notas internas ───────────────────────────

export async function agregarNotaInternaAction(
  tenantId: string,
  nota: string
): Promise<ActionResult> {
  const admin = await gate();
  if (!admin) return DENIED;
  const parsed = notaSchema.safeParse({ nota });
  if (!parsed.success) return { ok: false, error: "Escribe una nota." };

  const sb = createAdminClient();
  const { error } = await sb.from("admin_tenant_notas").insert({
    tenant_id: tenantId,
    admin_user_id: admin.user_id,
    admin_email: admin.email,
    nota: parsed.data.nota,
  });
  if (error) return { ok: false, error: error.message };

  await logEvent("tenant.nota_interna", tenantId);
  revalidate(tenantId);
  return { ok: true };
}
