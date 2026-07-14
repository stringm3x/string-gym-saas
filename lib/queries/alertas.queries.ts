import { createClient } from "@/lib/supabase/server";
import { countStockBajo } from "./productos.queries";
import { countProspectosSinContactar } from "./prospectos.queries";
import { hoyISO } from "@/lib/utils/dates";

export type AlertaTipo =
  | "vencimiento_hoy"
  | "vencimiento_proximo"
  | "stock_bajo"
  | "prospecto_sin_contactar"
  | "miembro_inactivo";

export interface Alerta {
  tipo: AlertaTipo;
  severidad: "info" | "warning" | "danger";
  titulo: string;
  descripcion: string;
  href: string;
  count?: number;
}

async function countVencimientoHoy(tenantId: string): Promise<number> {
  const supabase = await createClient();
  const hoy = new Date().toISOString().slice(0, 10);

  const { count, error } = await supabase
    .from("miembros")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("archivado", false)
    .eq("fecha_vencimiento", hoy);

  if (error) return 0;
  return count ?? 0;
}

async function countVencimientoProximo(tenantId: string): Promise<number> {
  const supabase = await createClient();
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const en7 = new Date();
  en7.setDate(en7.getDate() + 7);

  const { count, error } = await supabase
    .from("miembros")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("archivado", false)
    .gte("fecha_vencimiento", manana.toISOString().slice(0, 10))
    .lte("fecha_vencimiento", en7.toISOString().slice(0, 10));

  if (error) return 0;
  return count ?? 0;
}

async function countMiembrosInactivos(tenantId: string): Promise<number> {
  const supabase = await createClient();
  const catorceAtras = new Date(
    Date.now() - 14 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: activos, error: errActivos } = await supabase
    .from("miembros")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("archivado", false)
    // Vigente = fecha de vencimiento hoy o futura (fuente de verdad: la fecha).
    .gte("fecha_vencimiento", hoyISO());

  if (errActivos || !activos || activos.length === 0) return 0;

  const activoIds = activos.map((m) => m.id);

  const { data: conCheckin, error: errCheckin } = await supabase
    .from("checkins")
    .select("miembro_id")
    .eq("tenant_id", tenantId)
    .gte("fecha_hora", catorceAtras)
    .in("miembro_id", activoIds);

  if (errCheckin) return 0;

  const conCheckinSet = new Set(conCheckin?.map((c) => c.miembro_id) ?? []);
  return activoIds.filter((id) => !conCheckinSet.has(id)).length;
}

export async function getAlertas(
  tenantId: string,
  slug: string
): Promise<Alerta[]> {
  const [vencenHoy, vencenProximo, stockBajo, sinContactar, inactivos] =
    await Promise.all([
      countVencimientoHoy(tenantId),
      countVencimientoProximo(tenantId),
      countStockBajo(tenantId),
      countProspectosSinContactar(tenantId),
      countMiembrosInactivos(tenantId),
    ]);

  const alertas: Alerta[] = [];

  if (stockBajo > 0) {
    alertas.push({
      tipo: "stock_bajo",
      severidad: "danger",
      titulo: "Stock bajo",
      descripcion: `${stockBajo} producto${stockBajo !== 1 ? "s" : ""} por debajo del mínimo.`,
      href: `/${slug}/inventario/productos`,
      count: stockBajo,
    });
  }

  if (vencenHoy > 0) {
    alertas.push({
      tipo: "vencimiento_hoy",
      severidad: "warning",
      titulo: "Vencimientos hoy",
      descripcion: `${vencenHoy} miembro${vencenHoy !== 1 ? "s vencen" : " vence"} hoy.`,
      href: `/${slug}/miembros?filter=por_vencer`,
      count: vencenHoy,
    });
  }

  if (sinContactar > 0) {
    alertas.push({
      tipo: "prospecto_sin_contactar",
      severidad: "warning",
      titulo: "Prospectos sin contactar",
      descripcion: `${sinContactar} prospecto${sinContactar !== 1 ? "s llevan" : " lleva"} más de 24h sin contacto.`,
      href: `/${slug}/prospectos`,
      count: sinContactar,
    });
  }

  if (vencenProximo > 0) {
    alertas.push({
      tipo: "vencimiento_proximo",
      severidad: "info",
      titulo: "Vencimientos próximos",
      descripcion: `${vencenProximo} miembro${vencenProximo !== 1 ? "s vencen" : " vence"} en los próximos 7 días.`,
      href: `/${slug}/miembros?filter=por_vencer`,
      count: vencenProximo,
    });
  }

  if (inactivos > 0) {
    alertas.push({
      tipo: "miembro_inactivo",
      severidad: "info",
      titulo: "Miembros sin actividad",
      descripcion: `${inactivos} miembro${inactivos !== 1 ? "s activos no han" : " activo no ha"} hecho check-in en 14 días.`,
      href: `/${slug}/miembros`,
      count: inactivos,
    });
  }

  return alertas;
}
