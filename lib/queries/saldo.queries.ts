import { createClient } from "@/lib/supabase/server";

export type MovimientoTipo = "recarga" | "consumo" | "ajuste";

export interface MovimientoSaldo {
  id: string;
  tipo: MovimientoTipo;
  monto: number;
  concepto: string | null;
  referencia_id: string | null;
  created_at: string;
  /** Saldo resultante después de este movimiento (derivado). */
  saldo_resultante: number;
}

/** Cuenta miembros con saldo negativo (deuda) para la alerta del dashboard. */
export async function countMiembrosConDeuda(
  tenantId: string
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("saldo_miembro")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .lt("saldo_actual", 0);
  return count ?? 0;
}

/** IDs de miembros con deuda (saldo < 0) — para el filtro de la lista. */
export async function getMiembroIdsConDeuda(
  tenantId: string
): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("saldo_miembro")
    .select("miembro_id")
    .eq("tenant_id", tenantId)
    .lt("saldo_actual", 0);
  return (data ?? []).map((r) => r.miembro_id as string);
}

/** Saldo actual del miembro (0 si nunca ha tenido movimientos). */
export async function getSaldoMiembro(
  tenantId: string,
  miembroId: string
): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("saldo_miembro")
    .select("saldo_actual")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .maybeSingle();
  return data ? Number(data.saldo_actual) : 0;
}

/**
 * Aplica un movimiento al saldo: inserta en el historial y actualiza el saldo
 * actual (upsert). `montoConSigno` ya trae el signo (consumo negativo). Sin
 * transacción nativa: secuencial y defensivo, igual que el resto del app.
 */
async function aplicarMovimiento(params: {
  tenantId: string;
  miembroId: string;
  tipo: MovimientoTipo;
  montoConSigno: number;
  concepto: string;
  creadoPor?: string | null;
  referenciaId?: string | null;
}): Promise<{ ok: true; saldo: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const actual = await getSaldoMiembro(params.tenantId, params.miembroId);
  const nuevo = actual + params.montoConSigno;

  const { error: movErr } = await supabase.from("movimientos_saldo").insert({
    tenant_id: params.tenantId,
    miembro_id: params.miembroId,
    tipo: params.tipo,
    monto: params.montoConSigno,
    concepto: params.concepto,
    referencia_id: params.referenciaId ?? null,
    creada_por: params.creadoPor ?? null,
  });
  if (movErr) return { ok: false, error: movErr.message };

  const { error: saldoErr } = await supabase.from("saldo_miembro").upsert(
    {
      tenant_id: params.tenantId,
      miembro_id: params.miembroId,
      saldo_actual: nuevo,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,miembro_id" }
  );
  if (saldoErr) return { ok: false, error: saldoErr.message };

  return { ok: true, saldo: nuevo };
}

/** Recarga (depósito): entra saldo. */
export async function recargarSaldo(
  tenantId: string,
  miembroId: string,
  monto: number,
  concepto: string,
  creadoPor: string
) {
  return aplicarMovimiento({
    tenantId,
    miembroId,
    tipo: "recarga",
    montoConSigno: Math.abs(monto),
    concepto,
    creadoPor,
  });
}

/** Consumo (compra): sale saldo. Valida saldo suficiente antes. */
export async function consumirSaldo(
  tenantId: string,
  miembroId: string,
  monto: number,
  concepto: string,
  referenciaId?: string | null,
  creadoPor?: string | null
): Promise<{ ok: true; saldo: number } | { ok: false; error: string }> {
  const abs = Math.abs(monto);
  const actual = await getSaldoMiembro(tenantId, miembroId);
  if (actual < abs) {
    return {
      ok: false,
      error: `Saldo insuficiente. Disponible: $${actual.toLocaleString("es-MX")}.`,
    };
  }
  return aplicarMovimiento({
    tenantId,
    miembroId,
    tipo: "consumo",
    montoConSigno: -abs,
    concepto,
    referenciaId,
    creadoPor,
  });
}

/** Ajuste manual: corrección; el monto puede ser negativo (crea deuda). */
export async function ajustarSaldo(
  tenantId: string,
  miembroId: string,
  monto: number,
  concepto: string,
  creadoPor: string
) {
  return aplicarMovimiento({
    tenantId,
    miembroId,
    tipo: "ajuste",
    montoConSigno: monto,
    concepto,
    creadoPor,
  });
}

/** Historial de movimientos con el saldo resultante tras cada uno. */
export async function getMovimientosSaldo(
  tenantId: string,
  miembroId: string,
  limit = 20
): Promise<MovimientoSaldo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("movimientos_saldo")
    .select("id, tipo, monto, concepto, referencia_id, created_at")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const movimientos = (data ?? []) as Omit<
    MovimientoSaldo,
    "saldo_resultante"
  >[];

  // El saldo resultante del más reciente = saldo actual; se resta hacia atrás.
  let corriente = await getSaldoMiembro(tenantId, miembroId);
  return movimientos.map((m) => {
    const resultante = corriente;
    corriente -= Number(m.monto);
    return { ...m, monto: Number(m.monto), saldo_resultante: resultante };
  });
}
