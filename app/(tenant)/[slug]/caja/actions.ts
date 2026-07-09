"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getTenant } from "@/lib/tenant";
import {
  createPago,
  createVisitaRapida,
  anularPago,
} from "@/lib/queries/pagos.queries";
import { hasPermission } from "@/lib/permissions";
import { getMiembro } from "@/lib/queries/miembros.queries";
import { getGymFull } from "@/lib/queries/gyms.queries";
import { getGymMarca } from "@/lib/queries/marca.queries";
import { hasFeature } from "@/lib/features";
import { sendRecibo } from "@/lib/email/send-recibo";
import { dispararWhatsAppAutomatico } from "@/lib/integrations/whatsapp-automatico";
import { pagoSchema } from "@/lib/validations/pago.schema";
import { visitaRapidaSchema } from "@/lib/validations/visita-rapida.schema";

export interface PagoResult {
  ok: boolean;
  error: string | null;
  fieldErrors: Partial<Record<string, string>>;
  pagoId?: string;
}

export async function registerPagoAction(
  _prev: PagoResult,
  formData: FormData
): Promise<PagoResult> {
  const tenant = await getTenant();

  const cantidadRaw = formData.get("cantidad_producto");
  const raw = {
    miembro_id: String(formData.get("miembro_id") ?? ""),
    concepto: String(formData.get("concepto") ?? "membresia") as
      | "membresia"
      | "visita"
      | "producto"
      | "otro",
    monto: Number(formData.get("monto") ?? 0),
    metodo_pago: String(formData.get("metodo_pago") ?? "efectivo") as
      | "efectivo"
      | "tarjeta"
      | "transferencia",
    periodo_inicio: String(formData.get("periodo_inicio") ?? ""),
    periodo_fin: String(formData.get("periodo_fin") ?? ""),
    plan_id: String(formData.get("plan_id") ?? ""),
    promocion_id: String(formData.get("promocion_id") ?? ""),
    producto_id: String(formData.get("producto_id") ?? ""),
    cantidad_producto:
      cantidadRaw && String(cantidadRaw).trim() ? Number(cantidadRaw) : null,
  };

  const parsed = pagoSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0]?.toString();
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }

  const result = await createPago(tenant.id, parsed.data);

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: {} };
  }

  revalidatePath(`/${tenant.slug}/caja`);
  revalidatePath(`/${tenant.slug}/miembros`);
  if (parsed.data.miembro_id) {
    revalidatePath(`/${tenant.slug}/miembros/${parsed.data.miembro_id}`);
  }
  if (parsed.data.producto_id) {
    revalidatePath(`/${tenant.slug}/inventario/productos`);
    revalidatePath(`/${tenant.slug}/inventario/movimientos`);
  }

  // Recibo automático (no bloquea el pago).
  if (parsed.data.miembro_id) {
    const miembro = await getMiembro(tenant.id, parsed.data.miembro_id);
    if (miembro) {
      const h = await headers();
      const origin =
        h.get("origin") ?? `https://${h.get("host") ?? "app.stringwebs.com"}`;
      const reciboUrl = `${origin}/recibos/${result.token}`;

      // Capa 1: email con link (solo si tiene email; sendRecibo no lanza).
      if (miembro.email) {
        const [gym, marca] = await Promise.all([
          getGymFull(tenant.id),
          getGymMarca(tenant.id),
        ]);
        const esPro = hasFeature(tenant.plan, "personalizacion_colores");
        await sendRecibo({
          miembroEmail: miembro.email,
          miembroNombre: miembro.nombre,
          gymNombre: gym?.nombre ?? "",
          gymTelefono: gym?.telefono ?? null,
          gymDireccion: gym?.direccion ?? null,
          logoUrl: gym?.logo_url ?? null,
          colorAcento: esPro ? marca?.color_acento : undefined,
          monto: parsed.data.monto,
          fechaVencimiento: parsed.data.periodo_fin || null,
          reciboUrl,
        });
      }

      // Capa 3: WhatsApp automático (feature de Escala; dormido hasta que se
      // active la infra en Grupo 6). Solo dispara si el plan lo incluye.
      if (hasFeature(tenant.plan, "whatsapp_automatico")) {
        await dispararWhatsAppAutomatico({
          gymId: tenant.id,
          miembroNombre: miembro.nombre,
          telefono: miembro.telefono,
          monto: parsed.data.monto,
          fechaVencimiento: parsed.data.periodo_fin || null,
          reciboUrl,
        });
      }
    }
  }

  return { ok: true, error: null, fieldErrors: {}, pagoId: result.id };
}

export async function registrarVisitaRapidaAction(
  _prev: PagoResult,
  formData: FormData
): Promise<PagoResult> {
  const tenant = await getTenant();

  const raw = {
    nombre_visitante: String(formData.get("nombre_visitante") ?? ""),
    telefono_visitante: String(formData.get("telefono_visitante") ?? ""),
    monto: Number(formData.get("monto") ?? 0),
    metodo_pago: String(formData.get("metodo_pago") ?? "efectivo") as
      | "efectivo"
      | "tarjeta"
      | "transferencia",
  };

  const parsed = visitaRapidaSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0]?.toString();
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }

  const result = await createVisitaRapida(tenant.id, parsed.data);
  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: {} };
  }

  revalidatePath(`/${tenant.slug}/caja`);
  return { ok: true, error: null, fieldErrors: {}, pagoId: result.id };
}

export async function anularPagoAction(
  pagoId: string,
  motivo?: string
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "cancelar_pagos")) {
    return { ok: false, error: "No tienes permiso para anular pagos." };
  }

  const result = await anularPago(tenant.id, pagoId, motivo);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/${tenant.slug}/caja`);
  return { ok: true };
}
