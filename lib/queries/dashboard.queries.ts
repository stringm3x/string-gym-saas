import { createClient } from "@/lib/supabase/server";

// ============================================================
// MIEMBROS
// ============================================================

export interface MiembrosStats {
  total: number;
  activos: number;
  inactivos: number;
  por_vencer: number; // Próximos 7 días
}

export async function getMiembrosStats(
  tenantId: string
): Promise<MiembrosStats> {
  const supabase = await createClient();
  const hoyIso = new Date().toISOString().slice(0, 10);
  const en7 = new Date();
  en7.setDate(en7.getDate() + 7);
  const en7Iso = en7.toISOString().slice(0, 10);

  const [{ count: total }, { count: activos }, { count: por_vencer }] =
    await Promise.all([
      supabase
        .from("miembros")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("archivado", false),
      supabase
        .from("miembros")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("archivado", false)
        .gte("fecha_vencimiento", hoyIso),
      supabase
        .from("miembros")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("archivado", false)
        .gte("fecha_vencimiento", hoyIso)
        .lte("fecha_vencimiento", en7Iso),
    ]);

  const t = total ?? 0;
  const a = activos ?? 0;
  return {
    total: t,
    activos: a,
    inactivos: t - a,
    por_vencer: por_vencer ?? 0,
  };
}

// ============================================================
// INGRESOS
// ============================================================

export interface IngresosStats {
  hoy: number;
  semana: number;
  mes: number;
  mesAnterior: number;
}

export async function getIngresosStats(
  tenantId: string
): Promise<IngresosStats> {
  const supabase = await createClient();

  const ahora = new Date();
  const inicioDia = new Date(ahora);
  inicioDia.setHours(0, 0, 0, 0);

  const inicioSemana = new Date(inicioDia);
  const dow = inicioSemana.getDay();
  inicioSemana.setDate(inicioSemana.getDate() - (dow === 0 ? 6 : dow - 1));

  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const inicioMesAnt = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);

  // Una sola query desde inicio mes anterior, subdividir en memoria.
  const { data, error } = await supabase
    .from("pagos")
    .select("monto, fecha_pago")
    .eq("tenant_id", tenantId)
    .gte("fecha_pago", inicioMesAnt.toISOString());

  const empty: IngresosStats = { hoy: 0, semana: 0, mes: 0, mesAnterior: 0 };
  if (error || !data) return empty;

  for (const p of data) {
    const monto = Number(p.monto);
    const fecha = new Date(p.fecha_pago);

    if (fecha >= inicioMes) {
      empty.mes += monto;
      if (fecha >= inicioSemana) empty.semana += monto;
      if (fecha >= inicioDia) empty.hoy += monto;
    } else {
      empty.mesAnterior += monto;
    }
  }

  return empty;
}

// ============================================================
// CHECK-INS
// ============================================================

export interface CheckinsStats {
  hoy: number;
  ultimos7Dias: { fecha: string; cantidad: number }[];
}

export async function getCheckinsStats(
  tenantId: string
): Promise<CheckinsStats> {
  const supabase = await createClient();

  const ahora = new Date();
  const inicioDia = new Date(ahora);
  inicioDia.setHours(0, 0, 0, 0);

  const hace7 = new Date(inicioDia);
  hace7.setDate(hace7.getDate() - 6); // Incluye hoy = 7 días totales

  const { data, error } = await supabase
    .from("checkins")
    .select("fecha_hora")
    .eq("tenant_id", tenantId)
    .gte("fecha_hora", hace7.toISOString());

  if (error || !data) {
    return { hoy: 0, ultimos7Dias: [] };
  }

  // Agrupar por día (YYYY-MM-DD)
  const conteoPorDia = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(hace7);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    conteoPorDia.set(key, 0);
  }

  let hoyCount = 0;
  const hoyKey = inicioDia.toISOString().slice(0, 10);

  for (const c of data) {
    const fecha = new Date(c.fecha_hora);
    const key = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
      .toISOString()
      .slice(0, 10);
    conteoPorDia.set(key, (conteoPorDia.get(key) ?? 0) + 1);
    if (key === hoyKey) hoyCount += 1;
  }

  const ultimos7Dias = Array.from(conteoPorDia.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, cantidad]) => ({ fecha, cantidad }));

  return { hoy: hoyCount, ultimos7Dias };
}

// ============================================================
// MIEMBROS POR VENCER (lista accionable)
// ============================================================

export interface MiembroPorVencer {
  id: string;
  nombre: string;
  telefono: string | null;
  fecha_vencimiento: string;
}

export async function listMiembrosPorVencer(
  tenantId: string,
  diasAdelante = 7
): Promise<MiembroPorVencer[]> {
  const supabase = await createClient();
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const en = new Date(hoy);
  en.setDate(en.getDate() + diasAdelante);

  const { data, error } = await supabase
    .from("miembros")
    .select("id, nombre, telefono, fecha_vencimiento")
    .eq("tenant_id", tenantId)
    .eq("archivado", false)
    .gte("fecha_vencimiento", hoy.toISOString().slice(0, 10))
    .lte("fecha_vencimiento", en.toISOString().slice(0, 10))
    .order("fecha_vencimiento", { ascending: true })
    .limit(10);

  if (error || !data) return [];
  return data as MiembroPorVencer[];
}
