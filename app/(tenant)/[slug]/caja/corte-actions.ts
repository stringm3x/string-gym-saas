"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions";
import { getActiveStaff } from "@/lib/queries/staff.queries";
import { abrirCorte, cerrarCorte } from "@/lib/queries/cortes.queries";

async function quienSoy(tenantId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const staff = user ? await getActiveStaff(tenantId, user.id) : null;
  return { userId: user?.id ?? null, nombre: staff?.nombre ?? null };
}

export async function abrirCorteAction(
  fondoInicial: number
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "registrar_pagos")) {
    return { ok: false, error: "No tienes permiso para abrir turno." };
  }
  if (!Number.isFinite(fondoInicial) || fondoInicial < 0) {
    return { ok: false, error: "El fondo inicial no es válido." };
  }

  const { userId, nombre } = await quienSoy(tenant.id);
  const r = await abrirCorte(tenant.id, { fondoInicial, userId, nombre });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/caja`);
  return { ok: true };
}

export async function cerrarCorteAction(
  corteId: string,
  efectivoContado: number,
  notas: string
): Promise<{ ok: boolean; error?: string; diferencia?: number }> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "registrar_pagos")) {
    return { ok: false, error: "No tienes permiso para cerrar turno." };
  }
  if (!Number.isFinite(efectivoContado) || efectivoContado < 0) {
    return { ok: false, error: "El efectivo contado no es válido." };
  }

  const { userId, nombre } = await quienSoy(tenant.id);
  const r = await cerrarCorte(tenant.id, corteId, {
    efectivoContado,
    notas: notas.trim() || null,
    userId,
    nombre,
  });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/caja`);
  return { ok: true, diferencia: r.diferencia };
}
