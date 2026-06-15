import { createClient } from "@/lib/supabase/server";
import type { PagoInput } from "@/lib/validations/pago.schema";

export type CategoriaCaja = "all" | "membresia" | "producto" | "otros";

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
  plan_id: string | null;
  promocion_id: string | null;
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
    plan_id: input.plan_id || null,
    promocion_id: input.promocion_id || null,
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
 * Convierte categoría de UI a array de conceptos de DB.
 */
function categoriaAConceptos(cat: CategoriaCaja): string[] | null {
  if (cat === "all") return null;
  if (cat === "membresia") return ["membresia", "visita"];
  if (cat === "producto") return ["producto"];
  if (cat === "otros") return ["otro"];
  return null;
}

/**
 * Lista pagos del día (filtrable por categoría) con miembro embebido.
 */
export async function listPagosDelDia(
  tenantId: string,
  categoria: CategoriaCaja = "all",
  limit = 50
): Promise<PagoConMiembro[]> {
  const supabase = await createClient();

  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  let q = supabase
    .from("pagos")
    .select(
      "id, tenant_id, miembro_id, concepto, monto, metodo_pago, fecha_pago, periodo_inicio, periodo_fin, plan_id, promocion_id, created_at, miembros(nombre)"
    )
    .eq("tenant_id", tenantId)
    .gte("fecha_pago", inicioHoy.toISOString())
    .order("fecha_pago", { ascending: false })
    .limit(limit);

  const conceptos = categoriaAConceptos(categoria);
  if (conceptos) {
    q = q.in("concepto", conceptos);
  }

  const { data, error } = await q;
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
    plan_id: row.plan_id,
    promocion_id: row.promocion_id,
    created_at: row.created_at,
    miembro_nombre: row.miembros?.nombre ?? null,
  }));
}

export interface ResumenPeriodo {
  total: number;
  cantidad: number;
}

export interface ResumenCaja {
  dia: ResumenPeriodo;
  semana: ResumenPeriodo;
  mes: ResumenPeriodo;
}

/**
 * Calcula totales día/semana/mes para la categoría seleccionada.
 * Una sola query (rango mensual) y se subdividen en memoria.
 */
export async function getResumenCaja(
  tenantId: string,
  categoria: CategoriaCaja = "all"
): Promise<ResumenCaja> {
  const supabase = await createClient();

  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const inicioDia = new Date(ahora);
  inicioDia.setHours(0, 0, 0, 0);

  // Semana: lunes 00:00 de esta semana.
  const inicioSemana = new Date(inicioDia);
  const dow = inicioSemana.getDay(); // 0=domingo, 1=lunes...
  const diasARestar = dow === 0 ? 6 : dow - 1;
  inicioSemana.setDate(inicioSemana.getDate() - diasARestar);

  let q = supabase
    .from("pagos")
    .select("monto, fecha_pago, concepto")
    .eq("tenant_id", tenantId)
    .gte("fecha_pago", inicioMes.toISOString());

  const conceptos = categoriaAConceptos(categoria);
  if (conceptos) {
    q = q.in("concepto", conceptos);
  }

  const { data, error } = await q;

  const empty: ResumenPeriodo = { total: 0, cantidad: 0 };
  const resumen: ResumenCaja = {
    dia: { ...empty },
    semana: { ...empty },
    mes: { ...empty },
  };

  if (error || !data) return resumen;

  for (const p of data) {
    const monto = Number(p.monto);
    const fecha = new Date(p.fecha_pago);

    resumen.mes.total += monto;
    resumen.mes.cantidad += 1;

    if (fecha >= inicioSemana) {
      resumen.semana.total += monto;
      resumen.semana.cantidad += 1;
    }
    if (fecha >= inicioDia) {
      resumen.dia.total += monto;
      resumen.dia.cantidad += 1;
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
