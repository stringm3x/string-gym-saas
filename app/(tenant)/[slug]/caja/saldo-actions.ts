"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getSaldoMiembro, consumirSaldo, ajustarSaldo } from "@/lib/queries/saldo.queries";
import { aplicarMovimiento } from "@/lib/queries/productos.queries";

/** Saldo actual de un miembro (para mostrar la opción en Caja). */
export async function getSaldoMiembroAction(
  miembroId: string
): Promise<number> {
  const tenant = await getTenant();
  if (!hasFeature(tenant.plan, "saldo_miembro")) return 0;
  return getSaldoMiembro(tenant.id, miembroId);
}

interface VentaResult {
  ok: boolean;
  error?: string;
  saldo?: number;
}

/**
 * Cobra un producto con el saldo del miembro: descuenta stock, consume el
 * saldo (referenciando el movimiento de inventario) y NO crea un pago en caja
 * (el efectivo entró al recargar; aquí solo se consume el saldo).
 */
export async function venderConSaldoAction(
  miembroId: string,
  productoId: string,
  cantidad: number
): Promise<VentaResult> {
  const tenant = await getTenant();
  if (!hasFeature(tenant.plan, "saldo_miembro")) {
    return { ok: false, error: "Tu plan no incluye Saldo del miembro." };
  }
  if (!hasPermission(tenant.role, "registrar_pagos")) {
    return { ok: false, error: "No autorizado." };
  }
  const cant = Math.max(1, Math.floor(cantidad));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida." };

  const { data: producto } = await supabase
    .from("productos")
    .select("nombre, precio")
    .eq("tenant_id", tenant.id)
    .eq("id", productoId)
    .maybeSingle();
  if (!producto) return { ok: false, error: "Producto no encontrado." };

  const monto = Number(producto.precio) * cant;

  const saldo = await getSaldoMiembro(tenant.id, miembroId);
  if (saldo < monto) {
    return {
      ok: false,
      error: `Saldo insuficiente. Disponible: $${saldo.toLocaleString("es-MX")}.`,
    };
  }

  // 1. Descontar stock (valida existencias).
  const mov = await aplicarMovimiento(tenant.id, {
    producto_id: productoId,
    tipo: "salida",
    cantidad: cant,
    motivo: "Venta con saldo",
  });
  if (!mov.ok) return { ok: false, error: mov.error };

  // 2. Consumir el saldo, referenciando el movimiento de inventario.
  const res = await consumirSaldo(
    tenant.id,
    miembroId,
    monto,
    `${producto.nombre}${cant > 1 ? ` x${cant}` : ""}`,
    mov.id,
    user.id
  );
  if (!res.ok) {
    // Reversa del stock si el consumo falló (no debería tras validar).
    await aplicarMovimiento(tenant.id, {
      producto_id: productoId,
      tipo: "entrada",
      cantidad: cant,
      motivo: "Reverso venta con saldo",
    });
    return { ok: false, error: res.error };
  }

  revalidatePath(`/${tenant.slug}/caja`);
  revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
  return { ok: true, saldo: res.saldo };
}
