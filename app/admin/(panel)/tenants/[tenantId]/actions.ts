"use server";

import { revalidatePath } from "next/cache";
import { adminAction } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADDONS_CATALOG } from "@/lib/addons";
import { exportTenantData } from "@/lib/utils/export-tenant";
import { sendDatosExportados } from "@/lib/email/export-tenant";
import {
  cambiarPlanSchema,
  suspenderSchema,
  cancelarSchema,
  extenderPruebaSchema,
  registrarPagoSchema,
  notaSchema,
} from "@/lib/validations/admin.schema";

export interface ActionResult {
  ok: boolean;
  error?: string;
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

// ─────────────────────────── Plan / fundador ───────────────────────────

export const cambiarPlanAction = adminAction(
  "admin.cambiar_plan",
  {},
  async (
    _ctx,
    tenantId: string,
    input: { plan: string; motivo?: string }
  ): Promise<ActionResult> => {
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
);

export const marcarFundadorAction = adminAction(
  "admin.marcar_fundador",
  {},
  async (_ctx, tenantId: string, esFundador: boolean): Promise<ActionResult> => {
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
);

// ─────────────────────────── Estado del tenant ───────────────────────────

/** Convierte un tenant en prueba a plan pagado: fija plan + estado activo. */
export const activarPlanPagadoAction = adminAction(
  "admin.activar_plan_pagado",
  {},
  async (
    _ctx,
    tenantId: string,
    input: { plan: string; motivo?: string }
  ): Promise<ActionResult> => {
    const parsed = cambiarPlanSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Datos inválidos." };

    const admin = createAdminClient();
    const { error } = await admin
      .from("gyms")
      .update({
        estado: "activo",
        plan: parsed.data.plan,
        fecha_inicio_suscripcion: new Date().toISOString(),
        prueba_hasta: null,
      })
      .eq("id", tenantId);
    if (error) return { ok: false, error: error.message };

    await logEvent("tenant.activar_plan_pagado", tenantId, {
      plan: parsed.data.plan,
      motivo: parsed.data.motivo ?? null,
    });
    revalidate(tenantId);
    return { ok: true };
  }
);

export const suspenderTenantAction = adminAction(
  "admin.suspender_tenant",
  {},
  async (_ctx, tenantId: string, motivo: string): Promise<ActionResult> => {
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
);

export const reactivarTenantAction = adminAction(
  "admin.reactivar_tenant",
  {},
  async (_ctx, tenantId: string): Promise<ActionResult> => {
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
);

export const cancelarTenantAction = adminAction(
  "admin.cancelar_tenant",
  {},
  async (
    _ctx,
    tenantId: string,
    input: { motivo: string; exportar: boolean }
  ): Promise<ActionResult> => {
    const parsed = cancelarSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Indica un motivo de cancelación." };
    }

    const admin = createAdminClient();

    // Exportación de datos: si se pidió, se genera el ZIP y se envía al owner
    // ANTES de cancelar. Si el envío falla, se marca pendiente para reintentar.
    let exportPendiente = false;
    let exportEnviado = false;
    if (parsed.data.exportar) {
      exportPendiente = true;
      try {
        const { data: gym } = await admin
          .from("gyms")
          .select("owner_id, nombre, slug")
          .eq("id", tenantId)
          .single();
        const { data: u } = gym?.owner_id
          ? await admin.auth.admin.getUserById(gym.owner_id)
          : { data: null };
        const email = u?.user?.email;
        if (gym && email) {
          const zip = await exportTenantData(tenantId);
          exportEnviado = await sendDatosExportados({
            email,
            nombreGym: gym.nombre,
            slug: gym.slug,
            zip,
          });
          exportPendiente = !exportEnviado;
        }
      } catch (e) {
        console.error("[cancelarTenant] export falló:", e);
        exportPendiente = true;
      }
    }

    const { error } = await admin
      .from("gyms")
      .update({
        estado: "cancelado",
        suspendido_at: new Date().toISOString(),
        suspension_motivo: parsed.data.motivo,
        exportar_datos_pendiente: exportPendiente,
      })
      .eq("id", tenantId);
    if (error) return { ok: false, error: error.message };

    await logEvent("tenant.cancelar", tenantId, {
      motivo: parsed.data.motivo,
      exportar_solicitado: parsed.data.exportar,
      export_enviado: exportEnviado,
    });
    revalidate(tenantId);
    return { ok: true };
  }
);

export const extenderPruebaAction = adminAction(
  "admin.extender_prueba",
  {},
  async (_ctx, tenantId: string, dias: number): Promise<ActionResult> => {
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
);

// ─────────────────────────── Add-ons ───────────────────────────

export const toggleAddonAction = adminAction(
  "admin.toggle_addon",
  {},
  async (
    _ctx,
    tenantId: string,
    addonId: string,
    activo: boolean
  ): Promise<ActionResult> => {
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
);

// ─────────────────────────── Owner ───────────────────────────

export const resetPasswordOwnerAction = adminAction(
  "admin.reset_password_owner",
  {},
  async (_ctx, tenantId: string): Promise<ActionResult> => {
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
      ? `https://${process.env.APP_DOMAIN}/auth/nueva-password`
      : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) return { ok: false, error: error.message };

    await logEvent("tenant.reset_password_owner", tenantId, { email });
    return { ok: true };
  }
);

// ─────────────────────────── Pagos manuales ───────────────────────────

export const registrarPagoManualAction = adminAction(
  "admin.registrar_pago_manual",
  {},
  async (
    { admin },
    tenantId: string,
    input: {
      concepto: string;
      monto: number;
      metodo: string;
      fecha_pago: string;
      referencia?: string;
      notas?: string;
    }
  ): Promise<ActionResult> => {
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
);

// ─────────────────────────── Notas internas ───────────────────────────

export const agregarNotaInternaAction = adminAction(
  "admin.nota_interna",
  {},
  async ({ admin }, tenantId: string, nota: string): Promise<ActionResult> => {
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
);
