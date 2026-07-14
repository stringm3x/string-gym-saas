"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions";
import { getActiveStaff } from "@/lib/queries/staff.queries";
import {
  congelarMembresia,
  cambiarPlan,
  aprobarCongelacion,
  rechazarCongelacion,
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

export async function cambiarPlanAction(
  miembroId: string,
  nuevoPlanId: string
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "editar_miembros")) {
    return { ok: false, error: "No tienes permiso para esta acción." };
  }
  if (!nuevoPlanId) return { ok: false, error: "Elige un plan." };

  const { userId, nombre } = await quienSoy(tenant.id);
  const r = await cambiarPlan(tenant.id, miembroId, nuevoPlanId, {
    userId,
    nombre,
  });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
  return { ok: true };
}
