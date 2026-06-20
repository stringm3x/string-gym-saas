"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  createProducto,
  updateProducto,
  aplicarMovimiento,
} from "@/lib/queries/productos.queries";
import {
  productoSchema,
  movimientoSchema,
} from "@/lib/validations/producto.schema";

// ============================================================
// PRODUCTOS
// ============================================================

export interface ProductoFormState {
  ok: boolean;
  error: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

const empty: ProductoFormState = { ok: false, error: null, fieldErrors: {} };

function parseProducto(formData: FormData) {
  const costoRaw = formData.get("costo");
  const stockInicialRaw = formData.get("stock_inicial");
  const stockMinimoRaw = formData.get("stock_minimo");

  return {
    nombre: String(formData.get("nombre") ?? ""),
    categoria: String(formData.get("categoria") ?? ""),
    precio: Number(formData.get("precio") ?? 0),
    costo: costoRaw && String(costoRaw).trim() ? Number(costoRaw) : null,
    stock_inicial:
      stockInicialRaw && String(stockInicialRaw).trim()
        ? Number(stockInicialRaw)
        : null,
    stock_minimo:
      stockMinimoRaw && String(stockMinimoRaw).trim()
        ? Number(stockMinimoRaw)
        : null,
  };
}

export async function createProductoAction(
  _prev: ProductoFormState,
  formData: FormData
): Promise<ProductoFormState> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "ver_inventario_movimientos")) {
    return { ...empty, error: "No tienes permiso para esta acción." };
  }
  const raw = parseProducto(formData);
  const parsed = productoSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0]?.toString();
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Revisa los campos.", fieldErrors };
  }

  const result = await createProducto(tenant.id, parsed.data);
  if (!result.ok) return { ...empty, error: result.error };

  revalidatePath(`/${tenant.slug}/inventario/productos`);
  revalidatePath(`/${tenant.slug}/inventario/movimientos`);
  return { ok: true, error: null, fieldErrors: {} };
}

export async function updateProductoAction(
  id: string,
  _prev: ProductoFormState,
  formData: FormData
): Promise<ProductoFormState> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "ver_inventario_movimientos")) {
    return { ...empty, error: "No tienes permiso para esta acción." };
  }
  const raw = parseProducto(formData);
  const parsed = productoSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0]?.toString();
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Revisa los campos.", fieldErrors };
  }

  const result = await updateProducto(tenant.id, id, parsed.data);
  if (!result.ok) return { ...empty, error: result.error };

  revalidatePath(`/${tenant.slug}/inventario/productos`);
  return { ok: true, error: null, fieldErrors: {} };
}

// ============================================================
// MOVIMIENTOS DE INVENTARIO
// ============================================================

export interface MovimientoFormState {
  ok: boolean;
  error: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export async function registerMovimientoAction(
  _prev: MovimientoFormState,
  formData: FormData
): Promise<MovimientoFormState> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "ver_inventario_movimientos")) {
    return { ok: false, error: "No tienes permiso para esta acción.", fieldErrors: {} };
  }
  const raw = {
    producto_id: String(formData.get("producto_id") ?? ""),
    tipo: String(formData.get("tipo") ?? "entrada") as
      | "entrada"
      | "salida"
      | "ajuste",
    cantidad: Number(formData.get("cantidad") ?? 0),
    motivo: String(formData.get("motivo") ?? ""),
  };

  const parsed = movimientoSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0]?.toString();
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Revisa los campos.", fieldErrors };
  }

  const result = await aplicarMovimiento(tenant.id, parsed.data);
  if (!result.ok) {
    return { ok: false, error: result.error, fieldErrors: {} };
  }

  revalidatePath(`/${tenant.slug}/inventario/productos`);
  revalidatePath(`/${tenant.slug}/inventario/movimientos`);
  return { ok: true, error: null, fieldErrors: {} };
}
