/**
 * Corte de caja / arqueo por turno (B1). Un turno se abre con un fondo inicial
 * en efectivo y al cerrar se cuadra el efectivo contado contra el esperado
 * (fondo + efectivo cobrado durante el turno). Los pagos del turno se asocian
 * por rango de tiempo [abierto_at, cerrado_at). Un solo corte abierto por gym.
 */
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CorteAbierto {
  id: string;
  fondo_inicial: number;
  abierto_por_nombre: string | null;
  abierto_at: string;
}

export interface CorteTotales {
  efectivo: number;
  tarjeta: number;
  transferencia: number;
  total: number;
  cantidad: number;
}

export interface CorteHistorial {
  id: string;
  estado: "abierto" | "cerrado";
  fondo_inicial: number;
  abierto_por_nombre: string | null;
  abierto_at: string;
  cerrado_por_nombre: string | null;
  cerrado_at: string | null;
  total_efectivo: number | null;
  total_tarjeta: number | null;
  total_transferencia: number | null;
  efectivo_esperado: number | null;
  efectivo_contado: number | null;
  diferencia: number | null;
  notas: string | null;
}

/** El corte abierto del gym, o null si no hay turno abierto. */
export async function getCorteAbierto(
  tenantId: string
): Promise<CorteAbierto | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cortes_caja")
    .select("id, fondo_inicial, abierto_por_nombre, abierto_at")
    .eq("tenant_id", tenantId)
    .eq("estado", "abierto")
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    fondo_inicial: Number(data.fondo_inicial),
    abierto_por_nombre: (data.abierto_por_nombre as string | null) ?? null,
    abierto_at: data.abierto_at as string,
  };
}

/** Suma de pagos no anulados por método en [desde, hasta). */
async function totalesEnRango(
  supabase: SupabaseClient,
  tenantId: string,
  desde: string,
  hasta: string
): Promise<CorteTotales> {
  const { data } = await supabase
    .from("pagos")
    .select("monto, metodo_pago")
    .eq("tenant_id", tenantId)
    .is("anulado_at", null)
    .gte("fecha_pago", desde)
    .lt("fecha_pago", hasta);

  const t: CorteTotales = {
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    total: 0,
    cantidad: 0,
  };
  for (const p of data ?? []) {
    const m = Number(p.monto);
    t.total += m;
    t.cantidad += 1;
    if (p.metodo_pago === "efectivo") t.efectivo += m;
    else if (p.metodo_pago === "tarjeta") t.tarjeta += m;
    else if (p.metodo_pago === "transferencia") t.transferencia += m;
  }
  return t;
}

/** Totales del turno en curso, hasta ahora. */
export async function resumenCorteEnVivo(
  tenantId: string,
  desde: string
): Promise<CorteTotales> {
  const supabase = await createClient();
  return totalesEnRango(supabase, tenantId, desde, new Date().toISOString());
}

/** Abre un turno. Falla si ya hay uno abierto (índice único parcial). */
export async function abrirCorte(
  tenantId: string,
  input: { fondoInicial: number; userId: string | null; nombre: string | null }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cortes_caja")
    .insert({
      tenant_id: tenantId,
      fondo_inicial: input.fondoInicial,
      abierto_por: input.userId,
      abierto_por_nombre: input.nombre,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "Ya hay un turno de caja abierto." };
    }
    return { ok: false, error: error?.message ?? "No se pudo abrir el turno." };
  }
  return { ok: true, id: data.id as string };
}

/** Cierra el turno: snapshot de totales + cuadre de efectivo. */
export async function cerrarCorte(
  tenantId: string,
  corteId: string,
  input: {
    efectivoContado: number;
    notas: string | null;
    userId: string | null;
    nombre: string | null;
  }
): Promise<{ ok: true; diferencia: number } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data: corte } = await supabase
    .from("cortes_caja")
    .select("abierto_at, fondo_inicial, estado")
    .eq("tenant_id", tenantId)
    .eq("id", corteId)
    .maybeSingle();
  if (!corte) return { ok: false, error: "Turno no encontrado." };
  if (corte.estado !== "abierto") {
    return { ok: false, error: "El turno ya está cerrado." };
  }

  const hasta = new Date().toISOString();
  const t = await totalesEnRango(
    supabase,
    tenantId,
    corte.abierto_at as string,
    hasta
  );
  const fondo = Number(corte.fondo_inicial);
  const esperado = fondo + t.efectivo;
  const diferencia = input.efectivoContado - esperado;

  const { error } = await supabase
    .from("cortes_caja")
    .update({
      estado: "cerrado",
      cerrado_por: input.userId,
      cerrado_por_nombre: input.nombre,
      cerrado_at: hasta,
      total_efectivo: t.efectivo,
      total_tarjeta: t.tarjeta,
      total_transferencia: t.transferencia,
      efectivo_esperado: esperado,
      efectivo_contado: input.efectivoContado,
      diferencia,
      notas: input.notas,
    })
    .eq("tenant_id", tenantId)
    .eq("id", corteId)
    .eq("estado", "abierto"); // guard contra doble cierre

  if (error) return { ok: false, error: error.message };
  return { ok: true, diferencia };
}

/** Historial de cortes del gym, más recientes primero. */
export async function listCortes(
  tenantId: string,
  limit = 30
): Promise<CorteHistorial[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cortes_caja")
    .select(
      "id, estado, fondo_inicial, abierto_por_nombre, abierto_at, cerrado_por_nombre, cerrado_at, total_efectivo, total_tarjeta, total_transferencia, efectivo_esperado, efectivo_contado, diferencia, notas"
    )
    .eq("tenant_id", tenantId)
    .order("abierto_at", { ascending: false })
    .limit(limit);

  const num = (v: unknown): number | null =>
    v === null || v === undefined ? null : Number(v);

  return (data ?? []).map((c) => ({
    id: c.id as string,
    estado: c.estado as "abierto" | "cerrado",
    fondo_inicial: Number(c.fondo_inicial),
    abierto_por_nombre: (c.abierto_por_nombre as string | null) ?? null,
    abierto_at: c.abierto_at as string,
    cerrado_por_nombre: (c.cerrado_por_nombre as string | null) ?? null,
    cerrado_at: (c.cerrado_at as string | null) ?? null,
    total_efectivo: num(c.total_efectivo),
    total_tarjeta: num(c.total_tarjeta),
    total_transferencia: num(c.total_transferencia),
    efectivo_esperado: num(c.efectivo_esperado),
    efectivo_contado: num(c.efectivo_contado),
    diferencia: num(c.diferencia),
    notas: (c.notas as string | null) ?? null,
  }));
}
