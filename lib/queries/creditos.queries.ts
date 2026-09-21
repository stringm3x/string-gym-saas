import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPago } from "@/lib/queries/pagos.queries";
import { logError } from "@/lib/log";
import { aplicarMovimiento } from "@/lib/queries/productos.queries";
import { calcularRangoPorDias } from "@/lib/utils/membresia-rango";
import { hoyISO } from "@/lib/utils/dates";
import {
  repartirMonto,
  fechasCuotas,
  diasEntreHoyY,
} from "@/lib/utils/creditos-calc";
import type { PlanPagoInput } from "@/lib/validations/creditos.schema";
import type {
  PlanPago,
  CuotaPago,
  PlanPagoConCuotas,
  CuotaPendiente,
  CuotaEstado,
  CxCResumen,
} from "@/lib/types/creditos";

type MetodoPago = "efectivo" | "tarjeta" | "transferencia";

// ─────────────────────────── mutaciones ───────────────────────────

/**
 * Borra un `planes_pago` que quedó a medias (sin cuotas, o sin el movimiento
 * de stock que le corresponde) cuando un paso posterior de su creación
 * falló. Créditos ya arrastra tres bugs conocidos (cuota 1 sin cobrar,
 * pagarCuota no atómico, reembolso sin desmarcar cuota) — este rollback no
 * le suma un cuarto: si el propio delete de limpieza falla, el plan queda
 * huérfano y Cuentas por Cobrar lo mostraría como un plan real que nadie va
 * a cobrar nunca. Se loguea para que no pase inadvertido.
 */
async function borrarPlanPagoHuerfano(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  planId: string,
  motivo: string
): Promise<void> {
  const { error } = await supabase.from("planes_pago").delete().eq("id", planId);
  if (error) {
    logError("credito.rollback_plan_huerfano", {
      tenantId,
      planId,
      motivo,
      error: error.message,
    });
  }
}

/**
 * Crea un plan de pago, genera sus N cuotas espaciadas por la frecuencia, y
 * cobra la cuota 1 de inmediato (paridad con createAbonoMembresia — antes
 * el plan quedaba con cuota 1 sin cobrar y nada se lo recordaba a nadie).
 * El total NO llega del cliente: se calcula acá del precio real del plan de
 * membresía o del producto (× cantidad) — antes era un campo libre sin
 * relación con lo que de verdad cuesta lo que se está financiando.
 */
export async function createPlanPago(
  tenantId: string,
  input: PlanPagoInput
): Promise<
  | { ok: true; id: string; reciboError?: string; cuota1Error?: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const esProducto = input.tipo === "producto";
  const cantidad = input.cantidad ?? 1;

  const restaurarStock = async () => {
    if (esProducto && input.producto_id) {
      await aplicarMovimiento(tenantId, {
        producto_id: input.producto_id,
        tipo: "entrada",
        cantidad,
        motivo: "Reverso plan a plazos",
      });
    }
  };

  // 0. Total real del plan/producto — nunca el que mande el cliente.
  let total: number;
  if (esProducto) {
    if (!input.producto_id) return { ok: false, error: "Selecciona un producto." };
    const { data: producto } = await supabase
      .from("productos")
      .select("precio")
      .eq("tenant_id", tenantId)
      .eq("id", input.producto_id)
      .maybeSingle();
    if (!producto) return { ok: false, error: "Producto no encontrado." };
    total = Math.round(Number(producto.precio) * cantidad * 100) / 100;
  } else {
    if (!input.plan_membresia_id) {
      return { ok: false, error: "Selecciona un plan de membresía." };
    }
    const { data: planMembresia } = await supabase
      .from("planes_membresia")
      .select("precio")
      .eq("tenant_id", tenantId)
      .eq("id", input.plan_membresia_id)
      .maybeSingle();
    if (!planMembresia) return { ok: false, error: "Plan de membresía no encontrado." };
    total = Number(planMembresia.precio);
  }

  // 1. Crear el plan primero — el movimiento de stock (paso 2) necesita su id
  //    para poder trazar el costo de esta venta hasta el corte de caja
  //    (el pago real llega después, en cuotas separadas sin producto_id).
  const { data: plan, error } = await supabase
    .from("planes_pago")
    .insert({
      tenant_id: tenantId,
      miembro_id: input.miembro_id,
      plan_membresia_id: esProducto ? null : input.plan_membresia_id,
      producto_id: esProducto ? input.producto_id : null,
      cantidad: esProducto ? cantidad : null,
      total,
      cuotas: input.cuotas,
      concepto: input.concepto || null,
      estado: "activo",
    })
    .select("id")
    .single();

  if (error || !plan) {
    return { ok: false, error: error?.message ?? "No se pudo crear el plan." };
  }

  // 2. Producto: el miembro se lo lleva hoy → se descuenta stock al crear el
  //    plan, enlazado (plan_pago_id) para calcular su costo en el corte.
  if (esProducto && input.producto_id) {
    const mov = await aplicarMovimiento(
      tenantId,
      {
        producto_id: input.producto_id,
        tipo: "salida",
        cantidad,
        motivo: "Plan a plazos (producto)",
      },
      undefined,
      plan.id
    );
    if (!mov.ok) {
      await borrarPlanPagoHuerfano(supabase, tenantId, plan.id, "movimiento_stock_fallo");
      return { ok: false, error: mov.error };
    }
  }

  const montos = repartirMonto(total, input.cuotas);
  const fechas = fechasCuotas(input.cuotas, input.frecuencia);
  const filas = montos.map((monto, i) => ({
    plan_id: plan.id,
    tenant_id: tenantId,
    numero_cuota: i + 1,
    monto,
    fecha_vencimiento: fechas[i],
  }));

  const { data: cuotasIns, error: cuotasErr } = await supabase
    .from("cuotas_pago")
    .insert(filas)
    .select("id, numero_cuota");

  if (cuotasErr || !cuotasIns) {
    // Rollback: no quedan planes sin cuotas, y se regresa el stock.
    await borrarPlanPagoHuerfano(supabase, tenantId, plan.id, "cuotas_insert_fallo");
    await restaurarStock();
    return { ok: false, error: cuotasErr?.message ?? "No se pudieron crear las cuotas." };
  }

  const cuota1 = cuotasIns.find((c) => c.numero_cuota === 1);
  if (!cuota1) {
    await borrarPlanPagoHuerfano(supabase, tenantId, plan.id, "cuota_1_no_encontrada");
    await restaurarStock();
    return { ok: false, error: "No se pudo registrar el plan." };
  }

  const pagoRes = await pagarCuota(tenantId, cuota1.id, input.metodo);
  if (!pagoRes.ok) {
    // El plan y sus cuotas YA EXISTEN — esto no es "no se pudo crear el
    // plan", es "se creó, pero la cuota 1 no se cobró". Devolverlo como
    // ok:false (como se hacía antes) le hacía creer al staff que nada
    // pasó, sin refrescar ni avisar del plan real que quedó a medias — con
    // la puerta abierta a reintentar "Crear plan" y duplicar el registro.
    // Se trata como éxito con aviso, mismo patrón que reciboError: cuota 1
    // queda pendiente, cobrable de inmediato desde la tarjeta del plan.
    return { ok: true, id: plan.id, cuota1Error: pagoRes.error };
  }

  return { ok: true, id: plan.id, reciboError: pagoRes.reciboError };
}

/**
 * Registra el pago de una cuota. Crea un pago en `pagos` (concepto membresía) y
 * linkea la cuota. En el PRIMER pago del plan extiende la membresía como un
 * cobro normal; en cuotas posteriores solo registra el pago (sin extender). Si
 * era la última cuota pendiente, marca el plan como completado.
 */
export async function pagarCuota(
  tenantId: string,
  cuotaId: string,
  metodo: MetodoPago = "efectivo"
): Promise<
  | { ok: true; pagoId: string; planCompletado: boolean; reciboError?: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();

  // Reclamo atómico: la condición pagado_at IS NULL va en el propio UPDATE,
  // no en un SELECT previo — así dos llamadas concurrentes para la misma
  // cuota (doble tap, dos pestañas, un reintento) no pueden ganar las dos.
  // Postgres re-evalúa el WHERE contra el valor vigente al tomar el lock de
  // fila, igual que el descuento de visitas en createCheckin. Antes el
  // check era un SELECT separado del UPDATE que marca pagada, con espacio
  // de sobra para que las dos pasaran el check y cobraran dos veces.
  const { data: claimed, error: claimErr } = await supabase
    .from("cuotas_pago")
    .update({ pagado_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", cuotaId)
    .is("pagado_at", null)
    .select("id, plan_id, monto")
    .maybeSingle();
  if (claimErr) return { ok: false, error: claimErr.message };
  if (!claimed) return { ok: false, error: "La cuota ya está pagada." };

  const revertirClaim = async () => {
    const { error } = await supabase
      .from("cuotas_pago")
      .update({ pagado_at: null })
      .eq("tenant_id", tenantId)
      .eq("id", cuotaId);
    if (error) {
      logError("credito.pagar_cuota_revertir_fallo", {
        tenantId,
        cuotaId,
        error: error.message,
      });
    }
  };

  const { data: plan } = await supabase
    .from("planes_pago")
    .select("id, miembro_id, plan_membresia_id, producto_id")
    .eq("tenant_id", tenantId)
    .eq("id", claimed.plan_id)
    .single();
  if (!plan) {
    await revertirClaim();
    return { ok: false, error: "Plan de pago no encontrado." };
  }

  // ¿Primer pago del plan? (ninguna OTRA cuota pagada aún — esta ya cuenta
  // como pagada por el reclamo de arriba, así que se excluye a sí misma).
  const { count: pagadasPrevias } = await supabase
    .from("cuotas_pago")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("plan_id", plan.id)
    .not("pagado_at", "is", null)
    .neq("id", cuotaId);
  const esPrimerPago = (pagadasPrevias ?? 0) === 0;

  // Solo el primer pago extiende la membresía (paridad con cobro normal).
  let periodoInicio: string | undefined;
  let periodoFin: string | undefined;
  if (esPrimerPago && plan.plan_membresia_id) {
    const { data: pm } = await supabase
      .from("planes_membresia")
      .select("dias_duracion")
      .eq("id", plan.plan_membresia_id)
      .maybeSingle();
    if (pm?.dias_duracion) {
      const { data: miembro } = await supabase
        .from("miembros")
        .select("fecha_vencimiento")
        .eq("tenant_id", tenantId)
        .eq("id", plan.miembro_id)
        .maybeSingle();
      const rango = calcularRangoPorDias(
        pm.dias_duracion,
        miembro?.fecha_vencimiento
      );
      periodoInicio = rango.periodo_inicio;
      periodoFin = rango.periodo_fin;
    }
  }

  // Producto: el pago se registra como 'producto' pero SIN producto_id, para
  // no volver a descontar stock (ya se descontó al crear el plan).
  const esProducto = !!plan.producto_id;
  const pagoRes = await createPago(tenantId, {
    miembro_id: plan.miembro_id,
    concepto: esProducto ? "producto" : "membresia",
    monto: Number(claimed.monto),
    metodo_pago: metodo,
    periodo_inicio: periodoInicio,
    periodo_fin: periodoFin,
    plan_id: plan.plan_membresia_id ?? undefined,
  });
  if (!pagoRes.ok) {
    // El cobro real falló: liberar el reclamo para que la cuota se pueda
    // volver a intentar, en vez de quedar "pagada" sin ningún pago real.
    await revertirClaim();
    return { ok: false, error: pagoRes.error };
  }

  // pagado_at ya quedó puesto por el reclamo de arriba — solo falta enlazar
  // qué pago la saldó. El dinero YA se cobró (createPago ya corrió), así
  // que si esto falla no se revierte: la cuota queda correctamente pagada,
  // solo sin el link directo al pago. Se loguea para poder enlazarlo a mano.
  const { error: linkErr } = await supabase
    .from("cuotas_pago")
    .update({ pago_id: pagoRes.id })
    .eq("tenant_id", tenantId)
    .eq("id", cuotaId);
  if (linkErr) {
    logError("credito.pagar_cuota_link_pago_fallo", {
      tenantId,
      cuotaId,
      pagoId: pagoRes.id,
      error: linkErr.message,
    });
  }

  // ¿Era la última cuota pendiente? → plan completado.
  const { count: pendientes } = await supabase
    .from("cuotas_pago")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("plan_id", plan.id)
    .is("pagado_at", null);
  const planCompletado = (pendientes ?? 0) === 0;
  if (planCompletado) {
    const { error: completarErr } = await supabase
      .from("planes_pago")
      .update({ estado: "completado" })
      .eq("tenant_id", tenantId)
      .eq("id", plan.id);
    // El pago de la última cuota ya se registró arriba (dinero real
    // cobrado); si esto falla, Cuentas por Cobrar seguiría mostrando el
    // plan como pendiente aunque ya esté saldado.
    if (completarErr) {
      logError("credito.marcar_plan_completado_fallo", {
        tenantId,
        planPagoId: plan.id,
        error: completarErr.message,
      });
    }
  }

  return {
    ok: true,
    pagoId: pagoRes.id,
    planCompletado,
    reciboError: pagoRes.reciboError,
  };
}

/**
 * Abono desde caja: el miembro paga una parte del precio del plan hoy, el
 * resto queda como saldo pendiente (Cuentas por Cobrar). Por dentro es un
 * `planes_pago` de 2 cuotas DESIGUALES (a diferencia de `createPlanPago`,
 * que siempre reparte parejo): la cuota 1 se cobra de inmediato — vía
 * `pagarCuota`, que ya sabe extender la membresía como un cobro normal — y
 * la cuota 2 queda pendiente con vencimiento igual al de la membresía.
 */
export async function createAbonoMembresia(
  tenantId: string,
  input: {
    miembroId: string;
    planMembresiaId: string;
    montoPagado: number;
    metodoPago: MetodoPago;
  }
): Promise<
  | {
      ok: true;
      pagoId?: string;
      montoRestante: number;
      reciboError?: string;
      cuota1Error?: string;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("planes_membresia")
    .select("id, nombre, precio, dias_duracion")
    .eq("tenant_id", tenantId)
    .eq("id", input.planMembresiaId)
    .maybeSingle();
  if (!plan) return { ok: false, error: "Plan no encontrado." };

  const precio = Number(plan.precio);
  if (!(input.montoPagado > 0) || input.montoPagado >= precio) {
    return {
      ok: false,
      error: "El abono debe ser mayor a 0 y menor al precio del plan.",
    };
  }
  const montoRestante = Math.round((precio - input.montoPagado) * 100) / 100;

  const { data: miembro } = await supabase
    .from("miembros")
    .select("fecha_vencimiento")
    .eq("tenant_id", tenantId)
    .eq("id", input.miembroId)
    .maybeSingle();
  const rango = calcularRangoPorDias(
    plan.dias_duracion,
    miembro?.fecha_vencimiento ?? null
  );

  const { data: planPago, error: planErr } = await supabase
    .from("planes_pago")
    .insert({
      tenant_id: tenantId,
      miembro_id: input.miembroId,
      plan_membresia_id: plan.id,
      total: precio,
      cuotas: 2,
      concepto: `Abono — ${plan.nombre}`,
      estado: "activo",
    })
    .select("id")
    .single();
  if (planErr || !planPago) {
    return { ok: false, error: planErr?.message ?? "No se pudo registrar el abono." };
  }

  const { data: cuotasIns, error: cuotasErr } = await supabase
    .from("cuotas_pago")
    .insert([
      {
        plan_id: planPago.id,
        tenant_id: tenantId,
        numero_cuota: 1,
        monto: input.montoPagado,
        fecha_vencimiento: hoyISO(),
      },
      {
        plan_id: planPago.id,
        tenant_id: tenantId,
        numero_cuota: 2,
        monto: montoRestante,
        fecha_vencimiento: rango.periodo_fin,
      },
    ])
    .select("id, numero_cuota");
  if (cuotasErr || !cuotasIns) {
    await borrarPlanPagoHuerfano(supabase, tenantId, planPago.id, "cuotas_insert_fallo");
    return { ok: false, error: cuotasErr?.message ?? "No se pudieron crear las cuotas." };
  }

  const cuota1 = cuotasIns.find((c) => c.numero_cuota === 1);
  if (!cuota1) {
    await borrarPlanPagoHuerfano(supabase, tenantId, planPago.id, "cuota_1_no_encontrada");
    return { ok: false, error: "No se pudo registrar el abono." };
  }

  const pagoRes = await pagarCuota(tenantId, cuota1.id, input.metodoPago);
  if (!pagoRes.ok) {
    // El plan de 2 cuotas ya existe — no se revierte, se puede cobrar de
    // nuevo desde la ficha. Pero devolver ok:false acá (como antes) le
    // hacía creer al caller que nada pasó: sin refrescar caja/ficha/CxC, y
    // con la puerta abierta a reintentar "Registrar abono" y crear un
    // segundo plan huérfano encima. Mismo patrón que reciboError: éxito
    // con aviso.
    return { ok: true, montoRestante, cuota1Error: pagoRes.error };
  }

  return {
    ok: true,
    pagoId: pagoRes.pagoId,
    montoRestante,
    reciboError: pagoRes.reciboError,
  };
}

// ─────────────────────────── lecturas ───────────────────────────

/** Planes de pago de un miembro con sus cuotas y progreso. */
export async function getPlanesPagoByMiembro(
  tenantId: string,
  miembroId: string
): Promise<PlanPagoConCuotas[]> {
  const supabase = await createClient();

  const { data: planes } = await supabase
    .from("planes_pago")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .order("created_at", { ascending: false });
  if (!planes || planes.length === 0) return [];

  const planIds = planes.map((p) => p.id);
  const { data: cuotas } = await supabase
    .from("cuotas_pago")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("plan_id", planIds)
    .order("numero_cuota", { ascending: true });

  const porPlan = new Map<string, CuotaPago[]>();
  for (const c of (cuotas ?? []) as CuotaPago[]) {
    const arr = porPlan.get(c.plan_id) ?? [];
    arr.push(c);
    porPlan.set(c.plan_id, arr);
  }

  return (planes as PlanPago[]).map((p) => {
    const lista = porPlan.get(p.id) ?? [];
    const pagadas = lista.filter((c) => c.pagado_at).length;
    const montoPagado = lista
      .filter((c) => c.pagado_at)
      .reduce((s, c) => s + Number(c.monto), 0);
    return {
      ...p,
      total: Number(p.total),
      cuotas_lista: lista,
      pagadas,
      monto_pagado: montoPagado,
      monto_pendiente: Number(p.total) - montoPagado,
    };
  });
}

/** Todas las cuotas pendientes del tenant, ordenadas por vencimiento (CxC). */
export async function getCuotasPendientes(
  tenantId: string
): Promise<CuotaPendiente[]> {
  const supabase = await createClient();

  const { data: cuotas } = await supabase
    .from("cuotas_pago")
    .select("*")
    .eq("tenant_id", tenantId)
    .is("pagado_at", null)
    .order("fecha_vencimiento", { ascending: true });
  if (!cuotas || cuotas.length === 0) return [];

  const planIds = [...new Set(cuotas.map((c) => c.plan_id))];
  const { data: planes } = await supabase
    .from("planes_pago")
    .select("id, concepto, miembro_id")
    .eq("tenant_id", tenantId)
    .in("id", planIds);
  const planMap = new Map(
    (planes ?? []).map((p) => [p.id, p])
  );

  const miembroIds = [
    ...new Set((planes ?? []).map((p) => p.miembro_id)),
  ];
  const { data: miembros } = await supabase
    .from("miembros")
    .select("id, nombre")
    .eq("tenant_id", tenantId)
    .in("id", miembroIds);
  const memMap = new Map((miembros ?? []).map((m) => [m.id, m.nombre]));

  return (cuotas as CuotaPago[]).map((c) => {
    const plan = planMap.get(c.plan_id);
    const dias = diasEntreHoyY(c.fecha_vencimiento);
    const estado: CuotaEstado = dias < 0 ? "vencida" : "pendiente";
    return {
      ...c,
      monto: Number(c.monto),
      miembro_nombre: plan ? memMap.get(plan.miembro_id) ?? null : null,
      plan_concepto: plan?.concepto ?? null,
      estado_calc: estado,
      dias_para_vencer: dias,
    };
  });
}

/**
 * Deuda vencida de un socio en planes a plazos activos (bloque 08) — antes
 * esto no se veía en ningún lado: el socio entraba igual al gym y la ficha
 * solo mostraba el plan a plazos si alguien bajaba a buscarlo hasta el
 * final de la página. Se usa para AVISAR, nunca para bloquear el check-in
 * (créditos nunca se ha usado con un socio real; un bloqueo duro arriesga
 * trabar a alguien por un recordatorio olvidado).
 */
export async function getDeudaVencida(
  tenantId: string,
  miembroId: string,
  client?: SupabaseClient
): Promise<{ monto: number; cuotas: number } | null> {
  const supabase = client ?? (await createClient());

  const { data: planes } = await supabase
    .from("planes_pago")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .eq("estado", "activo");
  const planIds = (planes ?? []).map((p) => p.id as string);
  if (planIds.length === 0) return null;

  const { data: cuotas } = await supabase
    .from("cuotas_pago")
    .select("monto")
    .eq("tenant_id", tenantId)
    .in("plan_id", planIds)
    .is("pagado_at", null)
    .lt("fecha_vencimiento", hoyISO());
  if (!cuotas || cuotas.length === 0) return null;

  return {
    monto: cuotas.reduce((sum, c) => sum + Number(c.monto), 0),
    cuotas: cuotas.length,
  };
}

/** Resumen de Cuentas por Cobrar: total pendiente, vencidas y por vencer (7d). */
export async function getCxCResumen(tenantId: string): Promise<CxCResumen> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("cuotas_pago")
    .select("monto, fecha_vencimiento")
    .eq("tenant_id", tenantId)
    .is("pagado_at", null);

  const resumen: CxCResumen = {
    total_pendiente: 0,
    vencidas_count: 0,
    vencidas_monto: 0,
    por_vencer_count: 0,
    por_vencer_monto: 0,
  };

  for (const c of data ?? []) {
    const monto = Number(c.monto);
    resumen.total_pendiente += monto;
    const dias = diasEntreHoyY(c.fecha_vencimiento);
    if (dias < 0) {
      resumen.vencidas_count++;
      resumen.vencidas_monto += monto;
    } else if (dias <= 7) {
      resumen.por_vencer_count++;
      resumen.por_vencer_monto += monto;
    }
  }

  return resumen;
}
