import { createClient } from "@/lib/supabase/server";
import type {
  ProductoInput,
  MovimientoInput,
} from "@/lib/validations/producto.schema";

// ============================================================
// TIPOS
// ============================================================

export interface Producto {
  id: string;
  tenant_id: string;
  nombre: string;
  categoria: string | null;
  precio: number;
  costo: number | null;
  created_at: string;
}

export interface ProductoConStock extends Producto {
  stock_actual: number;
  stock_minimo: number;
  unidades_vendidas: number;
  stock_bajo: boolean;
}

export interface MovimientoInventario {
  id: string;
  tenant_id: string;
  producto_id: string;
  tipo: "entrada" | "salida" | "ajuste";
  cantidad: number;
  motivo: string | null;
  pago_id: string | null;
  created_at: string;
}

export interface MovimientoConProducto extends MovimientoInventario {
  producto_nombre: string;
}

// ============================================================
// PRODUCTOS
// ============================================================

/**
 * Lista productos con su stock. Devuelve productos aunque no tengan fila
 * en `inventario` (mostrarán stock 0).
 */
export async function listProductosConStock(
  tenantId: string,
  search?: string
): Promise<ProductoConStock[]> {
  const supabase = await createClient();

  let q = supabase
    .from("productos")
    .select("*, inventario(stock_actual, stock_minimo, unidades_vendidas)")
    .eq("tenant_id", tenantId)
    .order("nombre");

  if (search && search.trim()) {
    q = q.ilike("nombre", `%${search.trim()}%`);
  }

  const { data, error } = await q;
  if (error || !data) return [];

  return data.map((p: any) => {
    const inv = Array.isArray(p.inventario) ? p.inventario[0] : p.inventario;
    const stock_actual = inv?.stock_actual ?? 0;
    const stock_minimo = inv?.stock_minimo ?? 0;
    return {
      id: p.id,
      tenant_id: p.tenant_id,
      nombre: p.nombre,
      categoria: p.categoria,
      precio: Number(p.precio),
      costo: p.costo === null ? null : Number(p.costo),
      created_at: p.created_at,
      stock_actual,
      stock_minimo,
      unidades_vendidas: inv?.unidades_vendidas ?? 0,
      stock_bajo: stock_minimo > 0 && stock_actual <= stock_minimo,
    };
  });
}

/**
 * Productos activos (con stock > 0 o sin restricción) para el selector de Caja.
 */
export async function listProductosParaVenta(
  tenantId: string
): Promise<ProductoConStock[]> {
  const all = await listProductosConStock(tenantId);
  return all.filter((p) => p.stock_actual > 0);
}

export async function getProducto(
  tenantId: string,
  id: string
): Promise<ProductoConStock | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("productos")
    .select("*, inventario(stock_actual, stock_minimo, unidades_vendidas)")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .single();
  if (error || !data) return null;

  const inv = Array.isArray(data.inventario)
    ? data.inventario[0]
    : data.inventario;
  const stock_actual = inv?.stock_actual ?? 0;
  const stock_minimo = inv?.stock_minimo ?? 0;

  return {
    id: data.id,
    tenant_id: data.tenant_id,
    nombre: data.nombre,
    categoria: data.categoria,
    precio: Number(data.precio),
    costo: data.costo === null ? null : Number(data.costo),
    created_at: data.created_at,
    stock_actual,
    stock_minimo,
    unidades_vendidas: inv?.unidades_vendidas ?? 0,
    stock_bajo: stock_minimo > 0 && stock_actual <= stock_minimo,
  };
}

/**
 * Crea producto + fila de inventario en una operación lógica.
 */
export async function createProducto(
  tenantId: string,
  input: ProductoInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("productos")
    .insert({
      tenant_id: tenantId,
      nombre: input.nombre,
      categoria: input.categoria || null,
      precio: input.precio,
      costo: input.costo ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "No se pudo crear el producto",
    };
  }

  // Crear fila de inventario asociada
  const { error: invError } = await supabase.from("inventario").insert({
    tenant_id: tenantId,
    producto_id: data.id,
    stock_actual: input.stock_inicial ?? 0,
    stock_minimo: input.stock_minimo ?? 0,
  });

  if (invError) {
    return {
      ok: false,
      error:
        "Producto creado, pero hubo error en inventario: " + invError.message,
    };
  }

  // Si hay stock inicial > 0, registrar como movimiento de entrada
  if (input.stock_inicial && input.stock_inicial > 0) {
    await supabase.from("movimientos_inventario").insert({
      tenant_id: tenantId,
      producto_id: data.id,
      tipo: "entrada",
      cantidad: input.stock_inicial,
      motivo: "Stock inicial",
    });
  }

  return { ok: true, id: data.id };
}

export async function updateProducto(
  tenantId: string,
  id: string,
  input: ProductoInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("productos")
    .update({
      nombre: input.nombre,
      categoria: input.categoria || null,
      precio: input.precio,
      costo: input.costo ?? null,
    })
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  // Actualizar stock_minimo en inventario si cambió
  if (input.stock_minimo !== undefined && input.stock_minimo !== null) {
    await supabase
      .from("inventario")
      .update({ stock_minimo: input.stock_minimo })
      .eq("tenant_id", tenantId)
      .eq("producto_id", id);
  }

  return { ok: true };
}

// ============================================================
// MOVIMIENTOS DE INVENTARIO
// ============================================================

/**
 * Aplica un movimiento de inventario: registra en el log y actualiza
 * stock_actual en `inventario`.
 *
 * - entrada: suma cantidad al stock
 * - salida: resta cantidad (cantidad debe ser positiva)
 * - ajuste: si cantidad es positiva suma, si es negativa resta
 *
 * pagoId es opcional — se llena cuando el movimiento viene de una venta en Caja.
 */
export async function aplicarMovimiento(
  tenantId: string,
  input: MovimientoInput,
  pagoId?: string
): Promise<
  { ok: true; id: string; nuevoStock: number } | { ok: false; error: string }
> {
  const supabase = await createClient();

  // Obtener stock actual
  const { data: invRow, error: invErr } = await supabase
    .from("inventario")
    .select("id, stock_actual")
    .eq("tenant_id", tenantId)
    .eq("producto_id", input.producto_id)
    .single();

  if (invErr || !invRow) {
    return { ok: false, error: "No se encontró el inventario del producto" };
  }

  let delta = 0;
  if (input.tipo === "entrada") {
    delta = Math.abs(input.cantidad);
  } else if (input.tipo === "salida") {
    delta = -Math.abs(input.cantidad);
  } else {
    // ajuste: respeta signo
    delta = input.cantidad;
  }

  const nuevoStock = invRow.stock_actual + delta;
  if (nuevoStock < 0) {
    return { ok: false, error: "Stock insuficiente" };
  }

  // Registrar movimiento
  const { data: mov, error: movErr } = await supabase
    .from("movimientos_inventario")
    .insert({
      tenant_id: tenantId,
      producto_id: input.producto_id,
      tipo: input.tipo,
      cantidad: Math.abs(input.cantidad),
      motivo: input.motivo || null,
      pago_id: pagoId ?? null,
    })
    .select("id")
    .single();

  if (movErr || !mov) {
    return {
      ok: false,
      error: movErr?.message ?? "No se pudo registrar el movimiento",
    };
  }

  // Actualizar stock
  const updates: Record<string, number> = { stock_actual: nuevoStock };
  if (input.tipo === "salida") {
    updates.unidades_vendidas =
      (await getUnidadesVendidas(tenantId, input.producto_id)) +
      Math.abs(input.cantidad);
  }

  const { error: updErr } = await supabase
    .from("inventario")
    .update(updates)
    .eq("id", invRow.id);

  if (updErr) {
    return {
      ok: false,
      error: "Movimiento registrado pero falló la actualización de stock",
    };
  }

  return { ok: true, id: mov.id, nuevoStock };
}

async function getUnidadesVendidas(
  tenantId: string,
  productoId: string
): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventario")
    .select("unidades_vendidas")
    .eq("tenant_id", tenantId)
    .eq("producto_id", productoId)
    .single();
  return data?.unidades_vendidas ?? 0;
}

export async function listMovimientos(
  tenantId: string,
  productoId?: string,
  limit = 50
): Promise<MovimientoConProducto[]> {
  const supabase = await createClient();

  let q = supabase
    .from("movimientos_inventario")
    .select("*, productos(nombre)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (productoId) {
    q = q.eq("producto_id", productoId);
  }

  const { data, error } = await q;
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    producto_id: row.producto_id,
    tipo: row.tipo,
    cantidad: row.cantidad,
    motivo: row.motivo,
    pago_id: row.pago_id,
    created_at: row.created_at,
    producto_nombre: row.productos?.nombre ?? "Producto eliminado",
  }));
}

/**
 * Cuenta productos con stock bajo — para el badge del sidebar.
 */
export async function countStockBajo(tenantId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventario")
    .select("stock_actual, stock_minimo")
    .eq("tenant_id", tenantId);
  if (error || !data) return 0;
  return data.filter(
    (i) => i.stock_minimo > 0 && i.stock_actual <= i.stock_minimo
  ).length;
}
