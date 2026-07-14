"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { getMiembro } from "@/lib/queries/miembros.queries";
import { getPlan } from "@/lib/queries/planes.queries";
import { createPago } from "@/lib/queries/pagos.queries";
import { calcularRangoPorDias } from "@/lib/utils/membresia-rango";

/**
 * Renovación en un clic (B3): cobra el plan indicado (por defecto el plan
 * actual del socio), calculando el periodo con la misma lógica del cobro
 * manual. Reusa createPago (RPC atómico).
 */
export async function renovarMiembroAction(
  miembroId: string,
  planId: string,
  metodo: "efectivo" | "tarjeta" | "transferencia"
): Promise<{ ok: boolean; error?: string; pagoId?: string }> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "registrar_pagos")) {
    return { ok: false, error: "No tienes permiso para cobrar." };
  }

  const [miembro, plan] = await Promise.all([
    getMiembro(tenant.id, miembroId),
    getPlan(tenant.id, planId),
  ]);
  if (!miembro) return { ok: false, error: "Miembro no encontrado." };
  if (!plan) return { ok: false, error: "Plan no encontrado." };

  const rango = calcularRangoPorDias(
    plan.dias_duracion,
    miembro.fecha_vencimiento
  );

  const r = await createPago(tenant.id, {
    miembro_id: miembroId,
    concepto: "membresia",
    monto: plan.precio,
    metodo_pago: metodo,
    plan_id: planId,
    promocion_id: "",
    producto_id: "",
    cantidad_producto: null,
    periodo_inicio: rango.periodo_inicio,
    periodo_fin: rango.periodo_fin,
  });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
  revalidatePath(`/${tenant.slug}/caja`);
  return { ok: true, pagoId: r.id };
}
