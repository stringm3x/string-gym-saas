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
  pagoMembresiaReciente,
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
import { createAbonoMembresia } from "@/lib/queries/creditos.queries";
import { resolverCajaDeVenta } from "@/lib/queries/cajas.queries";
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
  /** true si el error es un aviso de posible doble cobro (no un rechazo
   * definitivo): el cliente puede reenviar con confirmar_pago_duplicado=1. */
  duplicado?: boolean;
}

export async function registerPagoAction(
  _prev: PagoResult,
  formData: FormData
): Promise<PagoResult> {
  const tenant = await getTenant();
  // Única acción de cobro del archivo sin este check (bloque-04): sin él, y
  // sin guard tampoco en caja/page.tsx, un entrenador con la URL a mano
  // podía cobrar pese a que su rol dice "sin caja ni finanzas" (D6).
  if (!hasPermission(tenant.role, "registrar_pagos")) {
    return { ok: false, error: "No tienes permiso para cobrar.", fieldErrors: {} };
  }

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
    nombre_visitante: String(formData.get("nombre_visitante") ?? ""),
    telefono_visitante: String(formData.get("telefono_visitante") ?? ""),
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

  // La caja la decide QUÉ se vendió (el producto), no en qué pestaña estaba
  // parado el cajero — así no hay que cambiar de caja para cobrar bien.
  const cajaId = await resolverCajaDeVenta(
    tenant.id,
    parsed.data.producto_id || null
  );

  // Periodo de membresía: se recalcula SIEMPRE en servidor con el plan y el
  // vencimiento reales (igual que Ticket y Renovar) — antes se confiaba en
  // lo que mandaba el cliente, validado solo por formato (regex) en
  // pago.schema.ts. Dos pestañas cobrando al mismo socio casi a la vez
  // generaban dos pagos con una sola extensión de vigencia, y una pestaña
  // vieja (con un vencimiento ya superado en su estado local) podía pisar
  // fecha_vencimiento con una fecha anterior a la actual.
  let periodoMembresia = {
    periodo_inicio: parsed.data.periodo_inicio,
    periodo_fin: parsed.data.periodo_fin,
  };
  if (parsed.data.concepto === "membresia") {
    if (!parsed.data.miembro_id) {
      return {
        ok: false,
        error: "La membresía requiere un socio.",
        fieldErrors: {},
      };
    }
    const [miembroMembresia, planMembresia] = await Promise.all([
      getMiembro(tenant.id, parsed.data.miembro_id),
      parsed.data.plan_id
        ? getPlan(tenant.id, parsed.data.plan_id)
        : Promise.resolve(null),
    ]);
    if (!miembroMembresia) {
      return { ok: false, error: "Socio no encontrado.", fieldErrors: {} };
    }
    if (!planMembresia) {
      return { ok: false, error: "Plan no encontrado.", fieldErrors: {} };
    }
    const rango = calcularRangoPorDias(
      planMembresia.dias_duracion,
      miembroMembresia.fecha_vencimiento
    );
    periodoMembresia = {
      periodo_inicio: rango.periodo_inicio,
      periodo_fin: rango.periodo_fin,
    };

    // Aviso de posible doble cobro (no bloquea): el mismo socio con un pago
    // de membresía en los últimos 5 minutos. El cajero confirma reenviando
    // con confirmar_pago_duplicado=1 (ver PagoForm.tsx) si de verdad quiere
    // cobrar otra vez (ej. corrigiendo un error de captura).
    if (formData.get("confirmar_pago_duplicado") !== "1") {
      const reciente = await pagoMembresiaReciente(
        tenant.id,
        parsed.data.miembro_id
      );
      if (reciente) {
        return {
          ok: false,
          error: `${miembroMembresia.nombre} ya tiene un pago de membresía registrado hace menos de 5 minutos. ¿Seguro que quieres cobrar otra vez?`,
          fieldErrors: {},
          duplicado: true,
        };
      }
    }
  }

  // Visita sin miembro: la persona no está inscrita. Se registra como visita
  // rápida con nombre libre (o "Visitante" si no se capturó). No crea miembro.
  if (parsed.data.concepto === "visita" && !parsed.data.miembro_id) {
    const result = await createVisitaRapida(
      tenant.id,
      {
        nombre_visitante: parsed.data.nombre_visitante?.trim() || "Visitante",
        telefono_visitante: parsed.data.telefono_visitante || "",
        monto: parsed.data.monto,
        metodo_pago: parsed.data.metodo_pago,
      },
      cajaId ?? undefined
    );
    if (!result.ok) {
      return { ok: false, error: result.error, fieldErrors: {} };
    }
    revalidatePath(`/${tenant.slug}/caja`);
    return { ok: true, error: null, fieldErrors: {}, pagoId: result.id };
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

  const result = await createPago(
    tenant.id,
    {
      ...parsed.data,
      monto: montoNeto,
      periodo_inicio: periodoMembresia.periodo_inicio,
      periodo_fin: periodoMembresia.periodo_fin,
    },
    cajaId ?? undefined
  );

  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: {} };
  }

  // Consumir el crédito y registrar cuánto se aplicó al pago. El pago ya se
  // registró arriba con el descuento del crédito pedido — aplicarCredito
  // ahora reclama cada nota de forma atómica (lib/queries/notas-credito.queries.ts)
  // y puede aplicar MENOS de lo pedido si otro cajero ya consumió la misma
  // nota casi al mismo tiempo. No revertimos el pago por esto (ya ocurrió),
  // pero se loguea visible: el descuento que se le dio al socio quedaría por
  // encima del crédito real que se consumió.
  if (creditoAplicado > 0 && parsed.data.miembro_id) {
    const creditoResult = await aplicarCredito(
      tenant.id,
      parsed.data.miembro_id,
      creditoAplicado
    );
    if (creditoResult.ok && creditoResult.aplicado < creditoAplicado) {
      console.error(
        `[caja] pago ${result.id}: se descontaron ${creditoAplicado} de crédito pero solo se pudo aplicar ${creditoResult.aplicado} (carrera con otro cobro sobre la misma nota del miembro ${parsed.data.miembro_id}).`
      );
    }
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
        const tieneColorGimnasio = hasFeature(tenant.plan, "color_gimnasio");
        await sendRecibo({
          miembroEmail: miembro.email,
          miembroNombre: miembro.nombre,
          gymNombre: gym?.nombre ?? "",
          gymTelefono: gym?.telefono ?? null,
          gymDireccion: gym?.direccion ?? null,
          logoUrl: gym?.logo_url ?? null,
          colorAcento: tieneColorGimnasio ? marca?.color_acento : undefined,
          monto: parsed.data.monto,
          fechaVencimiento: periodoMembresia.periodo_fin || null,
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
  // Mismo hueco que registerPagoAction (bloque-04): también cobra, también
  // sin check.
  if (!hasPermission(tenant.role, "registrar_pagos")) {
    return { ok: false, error: "No tienes permiso para cobrar.", fieldErrors: {} };
  }

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

  const cajaId = await resolverCajaDeVenta(tenant.id, null);
  const result = await createVisitaRapida(
    tenant.id,
    parsed.data,
    cajaId ?? undefined
  );
  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: {} };
  }

  revalidatePath(`/${tenant.slug}/caja`);
  return { ok: true, error: null, fieldErrors: {}, pagoId: result.id };
}

export interface AbonoResult {
  ok: boolean;
  error?: string;
  pagoId?: string;
  montoRestante?: number;
}

/**
 * Abono desde caja: cobra una parte del precio del plan hoy y deja el resto
 * como saldo pendiente en Cuentas por Cobrar (createAbonoMembresia crea un
 * plan a plazos de 2 cuotas desiguales y cobra la primera de inmediato).
 */
export async function registrarAbonoAction(
  miembroId: string,
  planMembresiaId: string,
  montoPagado: number,
  metodoPago: "efectivo" | "tarjeta" | "transferencia"
): Promise<AbonoResult> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "registrar_pagos")) {
    return { ok: false, error: "No tienes permiso para cobrar." };
  }

  const r = await createAbonoMembresia(tenant.id, {
    miembroId,
    planMembresiaId,
    montoPagado,
    metodoPago,
  });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/caja`);
  revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
  revalidatePath(`/${tenant.slug}/cuentas-por-cobrar`);
  return { ok: true, pagoId: r.pagoId, montoRestante: r.montoRestante };
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
