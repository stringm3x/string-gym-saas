"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions";
import { getActiveStaff, verifyStaffPin } from "@/lib/queries/staff.queries";
import { abrirCorte, cerrarCorte } from "@/lib/queries/cortes.queries";

interface Quien {
  userId: string | null;
  nombre: string | null;
}

async function quienSoy(tenantId: string): Promise<Quien> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const staff = user ? await getActiveStaff(tenantId, user.id) : null;
  return { userId: user?.id ?? null, nombre: staff?.nombre ?? null };
}

/**
 * Identidad confirmada por PIN — para tablets compartidas donde "la sesión
 * activa del navegador" no necesariamente es quien está parado en la caja.
 * Guarda el staff.id (no el auth user_id) en `abierto_por`/`cerrado_por`:
 * la columna no tiene FK, es solo un identificador + nombre snapshot, y aquí
 * no hay una sesión de auth propia de esa persona que asertar.
 */
async function quienSoyPorPin(
  tenantId: string,
  staffId: string,
  pin: string
): Promise<{ ok: true; quien: Quien } | { ok: false; error: string }> {
  const r = await verifyStaffPin(tenantId, staffId, pin);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, quien: { userId: staffId, nombre: r.nombre } };
}

export async function abrirCorteAction(
  cajaId: string,
  fondoInicial: number,
  checkin?: { staffId: string; pin: string }
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "registrar_pagos")) {
    return { ok: false, error: "No tienes permiso para abrir turno." };
  }
  if (!Number.isFinite(fondoInicial) || fondoInicial < 0) {
    return { ok: false, error: "El fondo inicial no es válido." };
  }

  let quien: Quien;
  if (checkin) {
    const r = await quienSoyPorPin(tenant.id, checkin.staffId, checkin.pin);
    if (!r.ok) return { ok: false, error: r.error };
    quien = r.quien;
  } else {
    quien = await quienSoy(tenant.id);
  }

  const r = await abrirCorte(tenant.id, cajaId, {
    fondoInicial,
    userId: quien.userId,
    nombre: quien.nombre,
  });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/caja`);
  return { ok: true };
}

export async function cerrarCorteAction(
  corteId: string,
  efectivoContado: number,
  notas: string,
  checkin?: { staffId: string; pin: string }
): Promise<{ ok: boolean; error?: string; diferencia?: number }> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "registrar_pagos")) {
    return { ok: false, error: "No tienes permiso para cerrar turno." };
  }
  if (!Number.isFinite(efectivoContado) || efectivoContado < 0) {
    return { ok: false, error: "El efectivo contado no es válido." };
  }

  let quien: Quien;
  if (checkin) {
    const r = await quienSoyPorPin(tenant.id, checkin.staffId, checkin.pin);
    if (!r.ok) return { ok: false, error: r.error };
    quien = r.quien;
  } else {
    quien = await quienSoy(tenant.id);
  }

  const r = await cerrarCorte(tenant.id, corteId, {
    efectivoContado,
    notas: notas.trim() || null,
    userId: quien.userId,
    nombre: quien.nombre,
  });
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/caja`);
  return { ok: true, diferencia: r.diferencia };
}
