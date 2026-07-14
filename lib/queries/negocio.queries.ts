/**
 * Métricas de negocio (D5): MRR, ARPU, LTV, churn. Estimaciones con criterios
 * explícitos sobre los datos actuales (sin snapshots históricos).
 *
 * - MRR: Σ (precio × 30 / dias_duracion) de socios vigentes con plan por tiempo.
 * - ARPU: MRR ÷ nº de esos socios.
 * - Churn (30d): un socio renovado tiene fecha_vencimiento futura, así que los
 *   "vencidos en los últimos 30 días" (fecha_vencimiento en [hoy-30, hoy)) son
 *   justamente los que no renovaron. churn = vencidos30 / (vigentes + vencidos30).
 * - LTV: ARPU ÷ churn (si churn > 0); fallback: ingreso histórico de membresías
 *   ÷ socios distintos con pago de membresía.
 */
import { createClient } from "@/lib/supabase/server";
import { hoyISO, isoMasDias } from "@/lib/utils/dates";

export interface MetricasNegocio {
  mrr: number;
  arpu: number;
  ltv: number;
  churnRate: number; // 0..1
  vigentes: number;
  churned: number;
}

function pickPlan(v: unknown): {
  precio: number;
  dias_duracion: number;
  tipo: string;
} | null {
  const o = Array.isArray(v) ? v[0] : v;
  if (!o) return null;
  const p = o as { precio?: number; dias_duracion?: number; tipo?: string };
  return {
    precio: Number(p.precio ?? 0),
    dias_duracion: Number(p.dias_duracion ?? 0),
    tipo: String(p.tipo ?? "tiempo"),
  };
}

export async function getMetricasNegocio(
  tenantId: string
): Promise<MetricasNegocio> {
  const supabase = await createClient();
  const hoy = hoyISO();
  const hace30 = isoMasDias(-30);

  const [vigentesRes, vencidos30Res] = await Promise.all([
    // Vigentes con plan → para MRR/ARPU.
    supabase
      .from("miembros")
      .select("plan_id, planes_membresia(precio, dias_duracion, tipo)")
      .eq("tenant_id", tenantId)
      .eq("archivado", false)
      .gte("fecha_vencimiento", hoy),
    // Vencidos en los últimos 30 días (no renovaron) → churn.
    supabase
      .from("miembros")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("archivado", false)
      .gte("fecha_vencimiento", hace30)
      .lt("fecha_vencimiento", hoy),
  ]);

  const vigentesRows = vigentesRes.data ?? [];
  const vigentes = vigentesRows.length;
  const churned = vencidos30Res.count ?? 0;

  // MRR: valor mensual normalizado de los planes por tiempo.
  let mrr = 0;
  let conPlanTiempo = 0;
  for (const r of vigentesRows) {
    const plan = pickPlan(r.planes_membresia);
    if (!plan || plan.tipo !== "tiempo" || plan.dias_duracion <= 0) continue;
    mrr += (plan.precio * 30) / plan.dias_duracion;
    conPlanTiempo += 1;
  }
  mrr = Math.round(mrr);
  const arpu = conPlanTiempo > 0 ? Math.round(mrr / conPlanTiempo) : 0;

  const base = vigentes + churned;
  const churnRate = base > 0 ? churned / base : 0;

  // LTV = ARPU / churn; si no hay churn, promedio histórico de membresías.
  let ltv = 0;
  if (churnRate > 0) {
    ltv = Math.round(arpu / churnRate);
  } else {
    const { data: pagos } = await supabase
      .from("pagos")
      .select("monto, miembro_id")
      .eq("tenant_id", tenantId)
      .eq("concepto", "membresia")
      .is("anulado_at", null)
      .is("reembolsado_at", null);
    const total = (pagos ?? []).reduce((s, p) => s + Number(p.monto), 0);
    const distintos = new Set(
      (pagos ?? []).map((p) => p.miembro_id).filter(Boolean)
    ).size;
    ltv = distintos > 0 ? Math.round(total / distintos) : 0;
  }

  return { mrr, arpu, ltv, churnRate, vigentes, churned };
}

export interface ReporteFinanciero {
  desde: string;
  hasta: string;
  ingresosPorMetodo: {
    efectivo: number;
    tarjeta: number;
    transferencia: number;
    total: number;
  };
  ingresosPorConcepto: {
    membresia: number;
    producto: number;
    visita: number;
    otro: number;
  };
  reembolsosEfectivo: number;
  reembolsosOtros: number;
  notasCredito: number;
  cortes: { cantidad: number; diferencia: number };
  ingresoNeto: number;
}

/** Reporte financiero del período [desde, hasta] (fechas YYYY-MM-DD, inclusivo). */
export async function getReporteFinanciero(
  tenantId: string,
  desde: string,
  hasta: string
): Promise<ReporteFinanciero> {
  const supabase = await createClient();
  const hastaExcl = isoMasDias(1, hasta); // fin de día inclusivo

  const [pagosRes, reembRes, cortesRes] = await Promise.all([
    supabase
      .from("pagos")
      .select("monto, metodo_pago, concepto")
      .eq("tenant_id", tenantId)
      .is("anulado_at", null)
      .is("reembolsado_at", null)
      .gte("fecha_pago", desde)
      .lt("fecha_pago", hastaExcl),
    supabase
      .from("reembolsos")
      .select("monto, tipo")
      .eq("tenant_id", tenantId)
      .gte("created_at", desde)
      .lt("created_at", hastaExcl),
    supabase
      .from("cortes_caja")
      .select("diferencia")
      .eq("tenant_id", tenantId)
      .eq("estado", "cerrado")
      .gte("cerrado_at", desde)
      .lt("cerrado_at", hastaExcl),
  ]);

  const met = { efectivo: 0, tarjeta: 0, transferencia: 0, total: 0 };
  const con = { membresia: 0, producto: 0, visita: 0, otro: 0 };
  for (const p of pagosRes.data ?? []) {
    const m = Number(p.monto);
    met.total += m;
    if (p.metodo_pago === "efectivo") met.efectivo += m;
    else if (p.metodo_pago === "tarjeta") met.tarjeta += m;
    else if (p.metodo_pago === "transferencia") met.transferencia += m;
    if (p.concepto === "membresia") con.membresia += m;
    else if (p.concepto === "producto") con.producto += m;
    else if (p.concepto === "visita") con.visita += m;
    else con.otro += m;
  }

  let reembolsosEfectivo = 0;
  let reembolsosOtros = 0;
  let notasCredito = 0;
  for (const r of reembRes.data ?? []) {
    const m = Number(r.monto);
    if (r.tipo === "nota_credito") notasCredito += m;
    else if (r.tipo === "efectivo") reembolsosEfectivo += m;
    else reembolsosOtros += m;
  }

  const cortes = {
    cantidad: (cortesRes.data ?? []).length,
    diferencia: (cortesRes.data ?? []).reduce(
      (s, c) => s + Number(c.diferencia ?? 0),
      0
    ),
  };

  const reembolsosTotal = reembolsosEfectivo + reembolsosOtros; // nota no sale caja
  const ingresoNeto = met.total - reembolsosTotal;

  return {
    desde,
    hasta,
    ingresosPorMetodo: met,
    ingresosPorConcepto: con,
    reembolsosEfectivo,
    reembolsosOtros,
    notasCredito,
    cortes,
    ingresoNeto,
  };
}

