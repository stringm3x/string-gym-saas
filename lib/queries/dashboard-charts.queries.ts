import { createClient } from "@/lib/supabase/server";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function medianoche(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─────────────── Sparklines de las cards de evento ───────────────

export interface DashboardSparklines {
  /** Ingresos diarios de los últimos 7 días (viejo → nuevo). */
  ingresosDiarios: number[];
  /** Visitas rápidas diarias de los últimos 7 días. */
  visitasDiarias: number[];
  /** Ingresos mensuales de los últimos 6 meses. */
  ingresosMensuales: number[];
}

/** Series cortas para los sparklines de las cards de ingresos/visitas. */
export async function getDashboardSparklines(
  tenantId: string
): Promise<DashboardSparklines> {
  const supabase = await createClient();
  const inicio = new Date();
  inicio.setMonth(inicio.getMonth() - 6);

  const { data } = await supabase
    .from("pagos")
    .select("fecha_pago, monto, anulado_at, es_visita_rapida")
    .eq("tenant_id", tenantId)
    .gte("fecha_pago", inicio.toISOString())
    .is("anulado_at", null);

  const hoy = medianoche();
  const inicio7 = new Date(hoy);
  inicio7.setDate(hoy.getDate() - 6);

  const ingresosDiarios = [0, 0, 0, 0, 0, 0, 0];
  const visitasDiarias = [0, 0, 0, 0, 0, 0, 0];
  const ingresosMensuales = [0, 0, 0, 0, 0, 0];
  const claveMes = (d: Date) => d.getFullYear() * 12 + d.getMonth();
  const baseMes = claveMes(new Date());

  for (const p of data ?? []) {
    const f = new Date(p.fecha_pago);
    const fMid = new Date(f);
    fMid.setHours(0, 0, 0, 0);
    const di = Math.floor((fMid.getTime() - inicio7.getTime()) / 86400000);
    const monto = Number(p.monto);
    if (di >= 0 && di <= 6) {
      ingresosDiarios[di] += monto;
      if (p.es_visita_rapida) visitasDiarias[di] += 1;
    }
    const mi = 5 - (baseMes - claveMes(f));
    if (mi >= 0 && mi <= 5) ingresosMensuales[mi] += monto;
  }

  return { ingresosDiarios, visitasDiarias, ingresosMensuales };
}

// ─────────────── Ingresos por semana (últimas 4 semanas) ───────────────

export interface IngresoSemana {
  label: string;
  monto: number;
}

/** Suma de pagos no anulados en 4 buckets de 7 días (el último = esta semana). */
export async function getIngresosPorSemana(
  tenantId: string
): Promise<IngresoSemana[]> {
  const supabase = await createClient();
  const hoy = medianoche();
  const inicio = new Date(hoy);
  inicio.setDate(hoy.getDate() - 27); // 4 semanas atrás (28 días)

  const { data } = await supabase
    .from("pagos")
    .select("fecha_pago, monto, anulado_at")
    .eq("tenant_id", tenantId)
    .gte("fecha_pago", inicio.toISOString())
    .is("anulado_at", null);

  const buckets = [0, 0, 0, 0];
  for (const p of data ?? []) {
    const f = new Date(p.fecha_pago);
    const dias = Math.floor((f.getTime() - inicio.getTime()) / 86400000);
    const idx = Math.min(3, Math.max(0, Math.floor(dias / 7)));
    buckets[idx] += Number(p.monto);
  }

  return [
    { label: "Sem 1", monto: buckets[0] },
    { label: "Sem 2", monto: buckets[1] },
    { label: "Sem 3", monto: buckets[2] },
    { label: "Esta sem", monto: buckets[3] },
  ];
}

// ─────────────── Check-ins por día de la semana ───────────────

export interface CheckinDia {
  dia: string;
  cantidad: number;
}

/** Check-ins de los últimos 60 días agregados por día de la semana (Lun–Dom). */
export async function getCheckinsPorDiaSemana(
  tenantId: string
): Promise<CheckinDia[]> {
  const supabase = await createClient();
  const desde = new Date(Date.now() - 60 * 86400000).toISOString();

  const { data } = await supabase
    .from("checkins")
    .select("fecha_hora")
    .eq("tenant_id", tenantId)
    .gte("fecha_hora", desde);

  // getDay(): 0=Dom … 6=Sáb. Reordenamos a Lun–Dom.
  const porDow = [0, 0, 0, 0, 0, 0, 0];
  for (const c of data ?? []) {
    porDow[new Date(c.fecha_hora).getDay()]++;
  }
  const orden = [1, 2, 3, 4, 5, 6, 0];
  const labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  return orden.map((dow, i) => ({ dia: labels[i], cantidad: porDow[dow] }));
}

// ─────────────── Retención ───────────────

export interface Retencion {
  pct: number;
  renovacionesMes: number;
  activos: number;
  sube: boolean;
  tendencia: { mes: string; renovaciones: number }[];
}

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/**
 * Renovaciones del mes ÷ miembros activos. Tendencia de 3 meses (renovaciones
 * = miembros distintos con un pago de membresía no anulado en el mes).
 */
export async function getRetencion(tenantId: string): Promise<Retencion> {
  const supabase = await createClient();
  const ahora = new Date();
  const inicioM2 = new Date(ahora.getFullYear(), ahora.getMonth() - 2, 1);

  const [pagosRes, activosRes] = await Promise.all([
    supabase
      .from("pagos")
      .select("fecha_pago, miembro_id, concepto, anulado_at")
      .eq("tenant_id", tenantId)
      .eq("concepto", "membresia")
      .is("anulado_at", null)
      .gte("fecha_pago", inicioM2.toISOString()),
    supabase
      .from("miembros")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("archivado", false)
      .gte("fecha_vencimiento", ymd(medianoche())),
  ]);

  // Miembros distintos con pago de membresía por mes (últimos 3 meses).
  const setPorMes: Array<Set<string>> = [new Set(), new Set(), new Set()];
  const claveMes = (d: Date) => d.getFullYear() * 12 + d.getMonth();
  const baseClave = claveMes(ahora);
  for (const p of pagosRes.data ?? []) {
    if (!p.miembro_id) continue;
    const idx = 2 - (baseClave - claveMes(new Date(p.fecha_pago)));
    if (idx >= 0 && idx <= 2) setPorMes[idx].add(p.miembro_id);
  }

  const tendencia = setPorMes.map((s, i) => {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - (2 - i), 1);
    return { mes: MESES[d.getMonth()], renovaciones: s.size };
  });

  const renovacionesMes = setPorMes[2].size;
  const renovacionesPrev = setPorMes[1].size;
  const activos = activosRes.count ?? 0;
  const pct = activos > 0 ? Math.round((renovacionesMes / activos) * 100) : 0;

  return {
    pct,
    renovacionesMes,
    activos,
    sube: renovacionesMes >= renovacionesPrev,
    tendencia,
  };
}

// ─────────────── Breakdown de membresías (donut) ───────────────

export interface MembresiasBreakdown {
  activos: number;
  porVencer: number;
  vencidos: number;
}

/** Buckets EXCLUSIVOS por vencimiento: vigente >7d / por vencer 7d / vencido. */
export async function getMembresiasBreakdown(
  tenantId: string
): Promise<MembresiasBreakdown> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("miembros")
    .select("fecha_vencimiento")
    .eq("tenant_id", tenantId)
    .eq("archivado", false);

  const hoy = ymd(medianoche());
  const en7 = ymd(new Date(Date.now() + 7 * 86400000));

  let activos = 0;
  let porVencer = 0;
  let vencidos = 0;
  for (const m of data ?? []) {
    const v = m.fecha_vencimiento as string | null;
    if (!v || v < hoy) vencidos++;
    else if (v <= en7) porVencer++;
    else activos++;
  }
  return { activos, porVencer, vencidos };
}
