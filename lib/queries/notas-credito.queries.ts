/**
 * Notas de crédito / saldo a favor (B2b). Nacen de un reembolso con tipo
 * 'nota_credito' y se consumen FIFO al cobrar. El saldo aplicado no se recuenta
 * como ingreso (ese dinero ya salió de ingresos al reembolsarse).
 */
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface NotaCredito {
  id: string;
  monto: number;
  saldo: number;
  estado: string;
  created_at: string;
}

/** Crea una nota de crédito (saldo = monto). Reusa el client dado. */
export async function crearNotaCredito(
  client: SupabaseClient,
  tenantId: string,
  input: { miembroId: string; monto: number; origenReembolsoId: string | null }
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client.from("notas_credito").insert({
    tenant_id: tenantId,
    miembro_id: input.miembroId,
    origen_reembolso_id: input.origenReembolsoId,
    monto: input.monto,
    saldo: input.monto,
    estado: "activa",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Crédito disponible de un miembro (suma de saldos de notas activas). */
export async function getCreditoDisponible(
  tenantId: string,
  miembroId: string
): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notas_credito")
    .select("saldo")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .eq("estado", "activa");
  return (data ?? []).reduce((s, n) => s + Number(n.saldo), 0);
}

/**
 * Consume `monto` del crédito del miembro (FIFO: notas más viejas primero).
 * Devuelve cuánto se aplicó realmente (nunca más que el saldo disponible).
 *
 * Cada nota se reclama con el mismo patrón atómico que autorizarCodigo en
 * kiosco.queries.ts: el UPDATE lleva el saldo leído como guarda en el WHERE
 * (`.eq("saldo", saldo)`), no un select-y-luego-update por separado. Si dos
 * cajeros aplican la misma nota casi al mismo tiempo, Postgres serializa el
 * segundo UPDATE contra el valor ya escrito por el primero: el WHERE deja de
 * matchear, 0 filas afectadas, y esa nota se salta en vez de que el segundo
 * cajero sobreescriba ciegamente el resultado del primero (que es lo que
 * pasaba antes: dos escrituras basadas en la misma lectura, la última gana).
 */
export async function aplicarCredito(
  tenantId: string,
  miembroId: string,
  monto: number
): Promise<{ ok: true; aplicado: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: notas, error } = await supabase
    .from("notas_credito")
    .select("id, saldo")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .eq("estado", "activa")
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message };

  let restante = monto;
  let aplicado = 0;
  for (const nota of notas ?? []) {
    if (restante <= 0) break;
    const saldo = Number(nota.saldo);
    if (saldo <= 0) continue;
    const usar = Math.min(saldo, restante);
    const nuevoSaldo = saldo - usar;
    const { data: claimed, error: updErr } = await supabase
      .from("notas_credito")
      .update({
        saldo: nuevoSaldo,
        estado: nuevoSaldo <= 0 ? "usada" : "activa",
      })
      .eq("tenant_id", tenantId)
      .eq("id", nota.id as string)
      .eq("saldo", nota.saldo as number)
      .select("id");
    if (updErr) return { ok: false, error: updErr.message };
    if (!claimed || claimed.length === 0) continue; // otro cajero ya la tocó
    restante -= usar;
    aplicado += usar;
  }

  return { ok: true, aplicado };
}
