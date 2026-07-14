"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import {
  createPago,
  createVisitaRapida,
  anularPago,
  registrarTicket,
  type TicketItemInput,
} from "@/lib/queries/pagos.queries";
import { getPlan } from "@/lib/queries/planes.queries";
import { calcularRangoPorDias } from "@/lib/utils/membresia-rango";
import {
  crearReembolso,
  type TipoDevolucion,
} from "@/lib/queries/reembolsos.queries";
import {
  getCreditoDisponible,
  aplicarCredito,
} from "@/lib/queries/notas-credito.queries";
import { hasPermission } from "@/lib/permissions";
import { getActiveStaff } from "@/lib/queries/staff.queries";
import { getMiembro } from "@/lib/queries/miembros.queries";
import { getGymFull } from "@/lib/queries/gyms.queries";
import { getGymMarca } from "@/lib/queries/marca.queries";
import { hasFeature } from "@/lib/features";
import { sendRecibo } from "@/lib/email/send-recibo";
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

  // Nota de crédito aplicada (B2b): el server valida contra el saldo real y
  // cobra solo el neto. El crédito no se recuenta como ingreso.
  const creditoPedido = Number(formData.get("credito_aplicado") ?? 0);
  let creditoAplicado = 0;
  if (creditoPedido > 0 && parsed.data.miembro_id) {
    const disponible = await getCreditoDisponible(
      tenant.id,
      parsed.data.miembro_id
    );
    creditoAplicado = Math.max(
      0,
      Math.min(creditoPedido, disponible, parsed.data.monto)
    );
  }
  const montoNeto = parsed.data.monto - creditoAplicado;

  const result = await createPago(tenant.id, {
    ...parsed.data,
    monto: montoNeto,
  });

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: {} };
  }

  // Consumir el crédito y registrar cuánto se aplicó al pago.
  if (creditoAplicado > 0 && parsed.data.miembro_id) {
    await aplicarCredito(tenant.id, parsed.data.miembro_id, creditoAplicado);
    const supabase = await createClient();
    await supabase
      .from("pagos")
      .update({ credito_aplicado: creditoAplicado })
      .eq("tenant_id", tenant.id)
      .eq("id", result.id);
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

      // WhatsApp automático (PAGO_REGISTRADO) se emite centralizado dentro de
      // createPago (Bloque 2), cubriendo caja, kiosco, créditos e inscripción.
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

export async function reembolsarPagoAction(
  pagoId: string,
  tipo: TipoDevolucion,
  motivo: string
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "cancelar_pagos")) {
    return { ok: false, error: "No tienes permiso para reembolsar." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const staff = user ? await getActiveStaff(tenant.id, user.id) : null;

  const r = await crearReembolso(tenant.id, {
    pagoId,
    tipo,
    motivo: motivo.trim() || null,
    userId: user?.id ?? null,
    nombre: staff?.nombre ?? null,
  });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/caja`);
  revalidatePath(`/${tenant.slug}/recibos/${pagoId}`);
  return { ok: true };
}

/**
 * Cobra un ticket multi-línea (B4). Recalcula precios y periodos server-side
 * (no confía en los montos del cliente) y registra todo de forma atómica.
 */
export async function registrarTicketAction(input: {
  metodo: "efectivo" | "tarjeta" | "transferencia";
  miembroId: string | null;
  productos: { producto_id: string; cantidad: number }[];
  membresia: { plan_id: string } | null;
}): Promise<{ ok: boolean; error?: string; ticketId?: string }> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "registrar_pagos")) {
    return { ok: false, error: "No tienes permiso para cobrar." };
  }
  if (input.productos.length === 0 && !input.membresia) {
    return { ok: false, error: "El ticket está vacío." };
  }

  const supabase = await createClient();
  const items: TicketItemInput[] = [];

  // Productos: precio desde la BD (server-autoritativo).
  if (input.productos.length > 0) {
    const ids = input.productos.map((p) => p.producto_id);
    const { data: prods } = await supabase
      .from("productos")
      .select("id, precio")
      .eq("tenant_id", tenant.id)
      .in("id", ids);
    const precioDe = new Map(
      (prods ?? []).map((p) => [p.id as string, Number(p.precio)])
    );
    for (const p of input.productos) {
      const precio = precioDe.get(p.producto_id);
      if (precio == null) return { ok: false, error: "Producto no encontrado." };
      const cantidad = Math.max(1, Math.floor(p.cantidad));
      items.push({
        tipo: "producto",
        producto_id: p.producto_id,
        cantidad,
        monto: precio * cantidad,
      });
    }
  }

  // Membresía: precio + periodo desde la BD.
  if (input.membresia) {
    if (!input.miembroId) {
      return { ok: false, error: "La membresía requiere un miembro." };
    }
    const [miembro, plan] = await Promise.all([
      getMiembro(tenant.id, input.miembroId),
      getPlan(tenant.id, input.membresia.plan_id),
    ]);
    if (!miembro) return { ok: false, error: "Miembro no encontrado." };
    if (!plan) return { ok: false, error: "Plan no encontrado." };
    const rango = calcularRangoPorDias(
      plan.dias_duracion,
      miembro.fecha_vencimiento
    );
    items.push({
      tipo: "membresia",
      plan_id: plan.id,
      monto: plan.precio,
      periodo_inicio: rango.periodo_inicio,
      periodo_fin: rango.periodo_fin,
    });
  }

  const r = await registrarTicket(tenant.id, {
    metodo: input.metodo,
    miembroId: input.miembroId,
    items,
  });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/caja`);
  revalidatePath(`/${tenant.slug}/inventario/productos`);
  revalidatePath(`/${tenant.slug}/inventario/movimientos`);
  if (input.miembroId) {
    revalidatePath(`/${tenant.slug}/miembros/${input.miembroId}`);
  }
  return { ok: true, ticketId: r.ticketId };
}

/** Crédito disponible de un miembro, para el PagoForm. */
export async function getCreditoDisponibleAction(
  miembroId: string
): Promise<number> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "registrar_pagos") || !miembroId) return 0;
  return getCreditoDisponible(tenant.id, miembroId);
}
