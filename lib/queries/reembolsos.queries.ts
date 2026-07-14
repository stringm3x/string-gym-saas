/**
 * Reembolsos (B2a). Un reembolso es la devolución del dinero de un pago que sí
 * ocurrió — distinto de anular (que marca un pago como error de captura). Deja
 * su propio rastro contable en `reembolsos`, marca el pago como reembolsado
 * (deja de contar como ingreso) y restaura stock si era producto.
 */
import { createClient } from "@/lib/supabase/server";
import { aplicarMovimiento } from "@/lib/queries/productos.queries";
import { crearNotaCredito } from "@/lib/queries/notas-credito.queries";

export type TipoDevolucion =
  | "efectivo"
  | "tarjeta"
  | "transferencia"
  | "nota_credito";

export interface ReembolsoInput {
  pagoId: string;
  motivo: string | null;
  tipo: TipoDevolucion;
  userId: string | null;
  nombre: string | null;
}

export interface Reembolso {
  id: string;
  pago_id: string;
  monto: number;
  motivo: string | null;
  tipo: string;
  creado_por_nombre: string | null;
  created_at: string;
}

/** Reembolsa un pago completo. Full refund (parcial = follow-up). */
export async function crearReembolso(
  tenantId: string,
  input: ReembolsoInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data: pago } = await supabase
    .from("pagos")
    .select("id, monto, concepto, producto_id, miembro_id, anulado_at, reembolsado_at")
    .eq("tenant_id", tenantId)
    .eq("id", input.pagoId)
    .maybeSingle();
  if (!pago) return { ok: false, error: "Pago no encontrado." };
  if (pago.anulado_at) {
    return { ok: false, error: "No se puede reembolsar un pago anulado." };
  }
  if (pago.reembolsado_at) {
    return { ok: false, error: "Este pago ya fue reembolsado." };
  }
  if (input.tipo === "nota_credito" && !pago.miembro_id) {
    return {
      ok: false,
      error: "La nota de crédito requiere un miembro asociado al pago.",
    };
  }

  const monto = Number(pago.monto);

  // 1. Documento de reembolso.
  const { data: reemb, error: reembErr } = await supabase
    .from("reembolsos")
    .insert({
      tenant_id: tenantId,
      pago_id: pago.id,
      miembro_id: pago.miembro_id ?? null,
      monto,
      motivo: input.motivo,
      tipo: input.tipo,
      creado_por: input.userId,
      creado_por_nombre: input.nombre,
    })
    .select("id")
    .single();
  if (reembErr || !reemb) {
    return {
      ok: false,
      error: reembErr?.message ?? "No se pudo registrar el reembolso.",
    };
  }

  // 2. Marcar el pago como reembolsado (deja de contar como ingreso).
  const { error: pagoErr } = await supabase
    .from("pagos")
    .update({
      reembolsado_at: new Date().toISOString(),
      reembolsado_motivo: input.motivo,
    })
    .eq("tenant_id", tenantId)
    .eq("id", pago.id);
  if (pagoErr) {
    return {
      ok: false,
      error: "El reembolso se registró, pero no se pudo marcar el pago.",
    };
  }

  // 3. Si la devolución es nota de crédito, emitir el saldo a favor.
  if (input.tipo === "nota_credito" && pago.miembro_id) {
    const nota = await crearNotaCredito(supabase, tenantId, {
      miembroId: pago.miembro_id as string,
      monto,
      origenReembolsoId: reemb.id as string,
    });
    if (!nota.ok) {
      return {
        ok: false,
        error: "El reembolso se registró, pero no se pudo emitir la nota de crédito.",
      };
    }
  }

  // 4. Restaurar stock si era venta de producto (cantidad del movimiento).
  if (pago.concepto === "producto" && pago.producto_id) {
    const { data: mov } = await supabase
      .from("movimientos_inventario")
      .select("cantidad")
      .eq("tenant_id", tenantId)
      .eq("pago_id", pago.id)
      .eq("tipo", "salida")
      .maybeSingle();
    const cantidad = mov ? Number(mov.cantidad) : 1;
    await aplicarMovimiento(tenantId, {
      producto_id: pago.producto_id as string,
      tipo: "entrada",
      cantidad,
      motivo: "Reembolso",
    });
  }

  return { ok: true, id: reemb.id as string };
}

/** Reembolsos de un pago (para el detalle del recibo). */
export async function getReembolsosByPago(
  tenantId: string,
  pagoId: string
): Promise<Reembolso[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reembolsos")
    .select("id, pago_id, monto, motivo, tipo, creado_por_nombre, created_at")
    .eq("tenant_id", tenantId)
    .eq("pago_id", pagoId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    pago_id: r.pago_id as string,
    monto: Number(r.monto),
    motivo: (r.motivo as string | null) ?? null,
    tipo: r.tipo as string,
    creado_por_nombre: (r.creado_por_nombre as string | null) ?? null,
    created_at: r.created_at as string,
  }));
}
