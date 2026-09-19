"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions";
import { getActiveStaff } from "@/lib/queries/staff.queries";
import {
  congelarMembresia,
  descongelarMembresia,
  cambiarPlan,
  calcularCambioPlan,
  aprobarCongelacion,
  rechazarCongelacion,
  type CambioPlanCalculo,
} from "@/lib/queries/miembro-eventos.queries";

async function quienSoy(tenantId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const staff = user ? await getActiveStaff(tenantId, user.id) : null;
  return { userId: user?.id ?? null, nombre: staff?.nombre ?? null };
}

export async function congelarMembresiaAction(
  miembroId: string,
  fechaInicio: string,
  fechaFin: string
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "editar_miembros")) {
    return { ok: false, error: "No tienes permiso para esta acción." };
  }
  if (!fechaInicio || !fechaFin) {
    return { ok: false, error: "Indica las fechas de la pausa." };
  }

  const { userId, nombre } = await quienSoy(tenant.id);
  const r = await congelarMembresia(tenant.id, miembroId, {
    fechaInicio,
    fechaFin,
    userId,
    nombre,
  });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
  return { ok: true };
}

export async function descongelarMembresiaAction(
  miembroId: string
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "editar_miembros")) {
    return { ok: false, error: "No tienes permiso para esta acción." };
  }

  const { userId, nombre } = await quienSoy(tenant.id);
  const r = await descongelarMembresia(tenant.id, miembroId, {
    userId,
    nombre,
  });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
  return { ok: true };
}

export async function aprobarCongelacionAction(
  miembroId: string,
  eventoId: string
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "editar_miembros")) {
    return { ok: false, error: "No tienes permiso para esta acción." };
  }
  const r = await aprobarCongelacion(tenant.id, eventoId);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
  return { ok: true };
}

export async function rechazarCongelacionAction(
  miembroId: string,
  eventoId: string
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "editar_miembros")) {
    return { ok: false, error: "No tienes permiso para esta acción." };
  }
  const r = await rechazarCongelacion(tenant.id, eventoId);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
  return { ok: true };
}

/**
 * Previsualiza el prorrateo de un cambio de plan (sin escribir nada): el
 * cajero debe ver la cuenta — días restantes, valor, días del plan nuevo,
 * saldo a favor si lo hay — antes de poder confirmar.
 */
export async function previsualizarCambioPlanAction(
  miembroId: string,
  nuevoPlanId: string
): Promise<{ ok: true; calculo: CambioPlanCalculo } | { ok: false; error: string }> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "registrar_pagos")) {
    return { ok: false, error: "No tienes permiso para esta acción." };
  }
  if (!nuevoPlanId) return { ok: false, error: "Elige un plan." };
  return calcularCambioPlan(tenant.id, miembroId, nuevoPlanId);
}

export async function cambiarPlanAction(
  miembroId: string,
  nuevoPlanId: string
): Promise<{ ok: boolean; error?: string; notaCredito?: number }> {
  const tenant = await getTenant();
  // Antes exigía "editar_miembros" (lo tiene hasta un entrenador, sin acceso
  // a caja por diseño — D6). Ahora prorratea y puede mover dinero (nota de
  // crédito), así que exige el mismo permiso que cobrar: es un bypass de
  // caja si un rol sin acceso a caja puede regalar/quitar días de vigencia.
  if (!hasPermission(tenant.role, "registrar_pagos")) {
    return { ok: false, error: "No tienes permiso para cambiar de plan." };
  }
  if (!nuevoPlanId) return { ok: false, error: "Elige un plan." };

  const { userId, nombre } = await quienSoy(tenant.id);
  const r = await cambiarPlan(tenant.id, miembroId, nuevoPlanId, {
    userId,
    nombre,
  });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
  return { ok: true, notaCredito: r.notaCredito };
}
