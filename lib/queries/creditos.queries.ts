import { createClient } from "@/lib/supabase/server";
import { createPago } from "@/lib/queries/pagos.queries";
import { calcularRangoPorDias } from "@/lib/utils/membresia-rango";
import {
  DIAS_FRECUENCIA,
  type PlanPagoInput,
} from "@/lib/validations/creditos.schema";
import type {
  PlanPago,
  CuotaPago,
  PlanPagoConCuotas,
  CuotaPendiente,
  CuotaEstado,
  CxCResumen,
} from "@/lib/types/creditos";

type MetodoPago = "efectivo" | "tarjeta" | "transferencia";

// ─────────────────────────── helpers ───────────────────────────

/** Fecha (YYYY-MM-DD) a `dias` de hoy, en hora local. */
function fechaISOaDias(dias: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Reparte `total` en `n` cuotas exactas (centavos), el remanente a la última. */
function repartirMonto(total: number, n: number): number[] {
  const totalCent = Math.round(total * 100);
  const base = Math.floor(totalCent / n);
  const montos = Array.from({ length: n }, () => base);
  montos[n - 1] += totalCent - base * n;
  return montos.map((c) => c / 100);
}

function diasEntreHoyY(fecha: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fecha + "T00:00:00");
  return Math.round((f.getTime() - hoy.getTime()) / 86400000);
}

// ─────────────────────────── mutaciones ───────────────────────────

/** Crea un plan de pago y genera sus N cuotas espaciadas por la frecuencia. */
export async function createPlanPago(
  tenantId: string,
  input: PlanPagoInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data: plan, error } = await supabase
    .from("planes_pago")
    .insert({
      tenant_id: tenantId,
      miembro_id: input.miembro_id,
      plan_membresia_id: input.plan_membresia_id,
      total: input.total,
      cuotas: input.cuotas,
      concepto: input.concepto || null,
      estado: "activo",
    })
    .select("id")
    .single();

  if (error || !plan) {
    return { ok: false, error: error?.message ?? "No se pudo crear el plan." };
  }

  const interval = DIAS_FRECUENCIA[input.frecuencia];
  const montos = repartirMonto(input.total, input.cuotas);
  const filas = montos.map((monto, i) => ({
    plan_id: plan.id,
    tenant_id: tenantId,
    numero_cuota: i + 1,
    monto,
    fecha_vencimiento: fechaISOaDias(i * interval),
  }));

  const { error: cuotasErr } = await supabase
    .from("cuotas_pago")
    .insert(filas);

  if (cuotasErr) {
    // Rollback del plan si las cuotas fallan (no quedan planes sin cuotas).
    await supabase.from("planes_pago").delete().eq("id", plan.id);
    return { ok: false, error: cuotasErr.message };
  }

  return { ok: true, id: plan.id };
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
  | { ok: true; pagoId: string; planCompletado: boolean }
  | { ok: false; error: string }
> {
  const supabase = await createClient();

  const { data: cuota } = await supabase
    .from("cuotas_pago")
    .select("id, plan_id, monto, pagado_at")
    .eq("tenant_id", tenantId)
    .eq("id", cuotaId)
    .maybeSingle();
  if (!cuota) return { ok: false, error: "Cuota no encontrada." };
  if (cuota.pagado_at) return { ok: false, error: "La cuota ya está pagada." };

  const { data: plan } = await supabase
    .from("planes_pago")
    .select("id, miembro_id, plan_membresia_id")
    .eq("tenant_id", tenantId)
    .eq("id", cuota.plan_id)
    .single();
  if (!plan) return { ok: false, error: "Plan de pago no encontrado." };

  // ¿Primer pago del plan? (ninguna cuota pagada aún)
  const { count: pagadasPrevias } = await supabase
    .from("cuotas_pago")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("plan_id", plan.id)
    .not("pagado_at", "is", null);
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

  const pagoRes = await createPago(tenantId, {
    miembro_id: plan.miembro_id,
    concepto: "membresia",
    monto: Number(cuota.monto),
    metodo_pago: metodo,
    periodo_inicio: periodoInicio,
    periodo_fin: periodoFin,
    plan_id: plan.plan_membresia_id ?? undefined,
  });
  if (!pagoRes.ok) return { ok: false, error: pagoRes.error };

  const { error: linkErr } = await supabase
    .from("cuotas_pago")
    .update({ pagado_at: new Date().toISOString(), pago_id: pagoRes.id })
    .eq("tenant_id", tenantId)
    .eq("id", cuotaId);
  if (linkErr) {
    return {
      ok: false,
      error:
        "El pago se registró, pero no se pudo marcar la cuota. Revísalo en caja.",
    };
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
    await supabase
      .from("planes_pago")
      .update({ estado: "completado" })
      .eq("tenant_id", tenantId)
      .eq("id", plan.id);
  }

  return { ok: true, pagoId: pagoRes.id, planCompletado };
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
