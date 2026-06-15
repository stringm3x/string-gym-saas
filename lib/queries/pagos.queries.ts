import { createClient } from "@/lib/supabase/server";
import type { PagoInput } from "@/lib/validations/pago.schema";

export interface Pago {
  id: string;
  tenant_id: string;
  miembro_id: string | null;
  concepto: "membresia" | "visita" | "producto" | "otro";
  monto: number;
  metodo_pago: "efectivo" | "tarjeta" | "transferencia" | null;
  fecha_pago: string;
  periodo_inicio: string | null;
  periodo_fin: string | null;
  created_at: string;
}

export interface PagoConMiembro extends Pago {
  miembro_nombre: string | null;
}

/**
 * Registra un pago. Si concepto = membresia, actualiza fecha_vencimiento
 * del miembro a periodo_fin (operación secuencial — Supabase no soporta
 * transacciones multi-tabla desde el cliente JS sin RPC).
 */
export async function createPago(
  tenantId: string,
  input: PagoInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();

  const payload = {
    tenant_id: tenantId,
    miembro_id: input.miembro_id || null,
    concepto: input.concepto,
    monto: input.monto,
    metodo_pago: input.metodo_pago,
    periodo_inicio: input.periodo_inicio || null,
    periodo_fin: input.periodo_fin || null,
  };

  const { data, error } = await supabase
    .from("pagos")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "No se pudo registrar el pago",
    };
  }

  // Si es pago de membresía, actualizar fecha_vencimiento del miembro.
  if (input.concepto === "membresia" && input.miembro_id && input.periodo_fin) {
    const { error: updError } = await supabase
      .from("miembros")
      .update({
        fecha_vencimiento: input.periodo_fin,
        estado: "activo",
      })
      .eq("tenant_id", tenantId)
      .eq("id", input.miembro_id);

    if (updError) {
      // El pago ya quedó registrado — devolvemos warning, no rollback.
      // En un sistema con RPC se haría como transacción.
      return {
        ok: false,
        error:
          "El pago se registró, pero no se pudo actualizar la fecha de vencimiento. Revísalo en el detalle del miembro.",
      };
    }
  }

  return { ok: true, id: data.id };
}

/**
 * Pagos del día actual con nombre del miembro embebido.
 */
export async function listPagosDelDia(
  tenantId: string,
  limit = 50
): Promise<PagoConMiembro[]> {
  const supabase = await createClient();

  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("pagos")
    .select(
      "id, tenant_id, miembro_id, concepto, monto, metodo_pago, fecha_pago, periodo_inicio, periodo_fin, created_at, miembros(nombre)"
    )
    .eq("tenant_id", tenantId)
    .gte("fecha_pago", inicioHoy.toISOString())
    .order("fecha_pago", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    miembro_id: row.miembro_id,
    concepto: row.concepto,
    monto: Number(row.monto),
    metodo_pago: row.metodo_pago,
    fecha_pago: row.fecha_pago,
    periodo_inicio: row.periodo_inicio,
    periodo_fin: row.periodo_fin,
    created_at: row.created_at,
    miembro_nombre: row.miembros?.nombre ?? null,
  }));
}

export interface ResumenDia {
  total: number;
  cantidad: number;
  porMetodo: Record<"efectivo" | "tarjeta" | "transferencia", number>;
}

export async function getResumenDia(tenantId: string): Promise<ResumenDia> {
  const supabase = await createClient();
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("pagos")
    .select("monto, metodo_pago")
    .eq("tenant_id", tenantId)
    .gte("fecha_pago", inicioHoy.toISOString());

  const resumen: ResumenDia = {
    total: 0,
    cantidad: 0,
    porMetodo: { efectivo: 0, tarjeta: 0, transferencia: 0 },
  };

  if (error || !data) return resumen;

  for (const p of data) {
    const monto = Number(p.monto);
    resumen.total += monto;
    resumen.cantidad += 1;
    if (p.metodo_pago && p.metodo_pago in resumen.porMetodo) {
      resumen.porMetodo[p.metodo_pago as keyof typeof resumen.porMetodo] +=
        monto;
    }
  }

  return resumen;
}

/**
 * Historial de pagos de un miembro.
 */
export async function listPagosByMiembro(
  tenantId: string,
  miembroId: string,
  limit = 30
): Promise<Pago[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pagos")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("miembro_id", miembroId)
    .order("fecha_pago", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((p) => ({ ...p, monto: Number(p.monto) }));
}
