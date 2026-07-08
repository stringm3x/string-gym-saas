import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createPago } from "@/lib/queries/pagos.queries";
import { calcularRangoPorDias } from "@/lib/utils/membresia-rango";

/** Producto disponible para comprar en el kiosco (admin client, público). */
export interface KioscoProducto {
  id: string;
  nombre: string;
  precio: number;
  stock: number;
}

/** Productos con stock > 0 del gym, para el autoservicio. */
export async function getProductosKiosco(
  tenantId: string
): Promise<KioscoProducto[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("productos")
    .select("id, nombre, precio, inventario(stock_actual)")
    .eq("tenant_id", tenantId)
    .order("nombre");

  return (data ?? [])
    .map((p) => {
      const inv = Array.isArray(p.inventario) ? p.inventario[0] : p.inventario;
      return {
        id: p.id as string,
        nombre: p.nombre as string,
        precio: Number(p.precio),
        stock: (inv?.stock_actual as number | undefined) ?? 0,
      };
    })
    .filter((p) => p.stock > 0);
}

/** Plan de membresía para renovar en el kiosco. */
export interface KioscoPlan {
  id: string;
  nombre: string;
  precio: number;
  dias_duracion: number;
}

/** Planes activos del gym (precio asc) para renovar en autoservicio. */
export async function getPlanesMembresiaKiosco(
  tenantId: string
): Promise<KioscoPlan[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("planes_membresia")
    .select("id, nombre, precio, dias_duracion")
    .eq("tenant_id", tenantId)
    .eq("activo", true)
    .order("precio", { ascending: true });

  return (data ?? []).map((p) => ({
    id: p.id as string,
    nombre: p.nombre as string,
    precio: Number(p.precio),
    dias_duracion: p.dias_duracion as number,
  }));
}

/** Código de 4 dígitos (con posible sesgo de módulo despreciable para el uso). */
function generarCodigo4(): string {
  return String(randomBytes(2).readUInt16BE(0) % 10000).padStart(4, "0");
}

/**
 * Genera un código de autorización único vigente en el gym y lo persiste.
 * Reintenta si choca con el índice único parcial (usado = false).
 */
export async function crearCodigoAutorizacion(params: {
  tenantId: string;
  tipo: "compra" | "membresia";
  payload: unknown;
  miembroId: string | null;
}): Promise<{ ok: boolean; codigo?: string; expiraAt?: string; error?: string }> {
  const admin = createAdminClient();

  for (let intento = 0; intento < 8; intento++) {
    const codigo = generarCodigo4();
    const { data, error } = await admin
      .from("codigos_autorizacion")
      .insert({
        tenant_id: params.tenantId,
        codigo,
        tipo: params.tipo,
        payload: params.payload,
        miembro_id: params.miembroId,
      })
      .select("codigo, expira_at")
      .single();

    if (!error && data) {
      return {
        ok: true,
        codigo: (data.codigo as string).trim(),
        expiraAt: data.expira_at as string,
      };
    }
    // 23505 = unique_violation → mismo código vigente; reintenta con otro.
    if (error?.code === "23505") continue;
    return { ok: false, error: error?.message ?? "No se pudo generar el código." };
  }

  return {
    ok: false,
    error: "No se pudo generar un código libre. Inténtalo de nuevo.",
  };
}

// ============================================================
// STAFF — AUTORIZACIONES (Bloque 4, session client / RLS)
// ============================================================

interface CompraPayload {
  metodo: string;
  total: number;
  items: { producto_id: string; nombre: string; cantidad: number; precio: number }[];
}

interface MembresiaPayload {
  planId: string;
  planNombre: string;
  monto: number;
  metodo: string;
}

/** Código pendiente tal como lo ve el staff en Caja. */
export interface CodigoPendiente {
  id: string;
  codigo: string;
  tipo: "compra" | "membresia";
  miembroNombre: string | null;
  metodo: string;
  total: number;
  detalle: string;
  items: { nombre: string; cantidad: number }[];
  expiraAt: string;
}

/** metodo del kiosco → metodo_pago de `pagos` (mercadopago se cobra por tarjeta). */
function aMetodoPago(m: string): "efectivo" | "transferencia" | "tarjeta" {
  if (m === "transferencia") return "transferencia";
  if (m === "mercadopago") return "tarjeta";
  return "efectivo";
}

/** Autorizaciones vigentes (no usadas, no expiradas) del gym. */
export async function getCodigosPendientes(
  tenantId: string
): Promise<CodigoPendiente[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("codigos_autorizacion")
    .select("id, codigo, tipo, payload, expira_at, miembros(nombre)")
    .eq("tenant_id", tenantId)
    .eq("usado", false)
    .gt("expira_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => {
    const tipo = row.tipo as "compra" | "membresia";
    const m = Array.isArray(row.miembros) ? row.miembros[0] : row.miembros;
    const miembroNombre = (m?.nombre as string | undefined) ?? null;

    if (tipo === "compra") {
      const p = row.payload as CompraPayload;
      const items = (p.items ?? []).map((i) => ({
        nombre: i.nombre,
        cantidad: i.cantidad,
      }));
      return {
        id: row.id as string,
        codigo: (row.codigo as string).trim(),
        tipo,
        miembroNombre,
        metodo: p.metodo,
        total: p.total,
        detalle: items.map((i) => `${i.cantidad}× ${i.nombre}`).join(", "),
        items,
        expiraAt: row.expira_at as string,
      };
    }

    const p = row.payload as MembresiaPayload;
    return {
      id: row.id as string,
      codigo: (row.codigo as string).trim(),
      tipo,
      miembroNombre,
      metodo: p.metodo,
      total: p.monto,
      detalle: p.planNombre,
      items: [],
      expiraAt: row.expira_at as string,
    };
  });
}

/** Conteo de autorizaciones pendientes (para el badge del sidebar). */
export async function countCodigosPendientes(tenantId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("codigos_autorizacion")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("usado", false)
    .gt("expira_at", new Date().toISOString());
  return count ?? 0;
}

/** Marca como usados los códigos ya expirados (housekeeping al abrir Caja). */
export async function limpiarExpirados(tenantId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("codigos_autorizacion")
    .update({ usado: true })
    .eq("tenant_id", tenantId)
    .eq("usado", false)
    .lt("expira_at", new Date().toISOString());
}

/** Rechaza un código pendiente (lo consume sin registrar pago). */
export async function rechazarCodigo(
  tenantId: string,
  codigoId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("codigos_autorizacion")
    .update({ usado: true })
    .eq("tenant_id", tenantId)
    .eq("id", codigoId)
    .eq("usado", false)
    .select("id")
    .maybeSingle();
  if (!data) return { ok: false, error: "El código ya no estaba pendiente." };
  return { ok: true };
}

/**
 * Autoriza un código: registra el/los pago(s), descuenta stock o extiende la
 * membresía, y lo consume. Usa un claim atómico (usado=false → true) para que
 * dos cajeros no lo procesen dos veces; revierte si el pago falla.
 */
export async function autorizarCodigo(
  tenantId: string,
  codigoId: string
): Promise<{ ok: boolean; error?: string; tipo?: "compra" | "membresia" }> {
  const supabase = await createClient();

  const { data: cod } = await supabase
    .from("codigos_autorizacion")
    .select("id, tipo, payload, miembro_id, usado, expira_at")
    .eq("tenant_id", tenantId)
    .eq("id", codigoId)
    .maybeSingle();

  if (!cod) return { ok: false, error: "Código no encontrado." };
  if (cod.usado) return { ok: false, error: "Este código ya fue procesado." };
  if (new Date(cod.expira_at as string).getTime() < Date.now()) {
    return { ok: false, error: "El código expiró." };
  }

  const tipo = cod.tipo as "compra" | "membresia";
  const miembroId = (cod.miembro_id as string | null) ?? "";

  // Pre-valida stock antes de consumir el código (evita autorización parcial).
  if (tipo === "compra") {
    const payload = cod.payload as CompraPayload;
    const ids = payload.items.map((i) => i.producto_id);
    const { data: invRows } = await supabase
      .from("productos")
      .select("id, nombre, inventario(stock_actual)")
      .eq("tenant_id", tenantId)
      .in("id", ids);
    const stock = new Map(
      (invRows ?? []).map((p) => {
        const inv = Array.isArray(p.inventario) ? p.inventario[0] : p.inventario;
        return [p.id as string, (inv?.stock_actual as number | undefined) ?? 0];
      })
    );
    for (const it of payload.items) {
      if (it.cantidad > (stock.get(it.producto_id) ?? 0)) {
        return { ok: false, error: `Sin stock suficiente de ${it.nombre}.` };
      }
    }
  }

  // Claim atómico: solo un cajero gana la carrera.
  const { data: claimed } = await supabase
    .from("codigos_autorizacion")
    .update({ usado: true })
    .eq("tenant_id", tenantId)
    .eq("id", codigoId)
    .eq("usado", false)
    .select("id")
    .maybeSingle();
  if (!claimed) {
    return { ok: false, error: "Este código ya fue procesado por otra caja." };
  }

  async function revertir() {
    await supabase
      .from("codigos_autorizacion")
      .update({ usado: false })
      .eq("tenant_id", tenantId)
      .eq("id", codigoId);
  }

  if (tipo === "compra") {
    const payload = cod.payload as CompraPayload;
    const metodo = aMetodoPago(payload.metodo);
    for (const it of payload.items) {
      const r = await createPago(tenantId, {
        concepto: "producto",
        producto_id: it.producto_id,
        cantidad_producto: it.cantidad,
        monto: it.precio * it.cantidad,
        metodo_pago: metodo,
        miembro_id: miembroId,
      });
      if (!r.ok) {
        await revertir();
        return { ok: false, error: r.error };
      }
    }
    return { ok: true, tipo };
  }

  // Membresía
  const payload = cod.payload as MembresiaPayload;
  const { data: plan } = await supabase
    .from("planes_membresia")
    .select("dias_duracion")
    .eq("tenant_id", tenantId)
    .eq("id", payload.planId)
    .maybeSingle();
  if (!plan) {
    await revertir();
    return { ok: false, error: "El plan ya no existe." };
  }

  const { data: miembro } = await supabase
    .from("miembros")
    .select("fecha_vencimiento")
    .eq("tenant_id", tenantId)
    .eq("id", miembroId)
    .maybeSingle();

  const rango = calcularRangoPorDias(
    plan.dias_duracion as number,
    (miembro?.fecha_vencimiento as string | null) ?? null
  );

  const r = await createPago(tenantId, {
    concepto: "membresia",
    miembro_id: miembroId,
    plan_id: payload.planId,
    monto: payload.monto,
    metodo_pago: aMetodoPago(payload.metodo),
    periodo_inicio: rango.periodo_inicio,
    periodo_fin: rango.periodo_fin,
  });
  if (!r.ok) {
    await revertir();
    return { ok: false, error: r.error };
  }

  return { ok: true, tipo };
}
