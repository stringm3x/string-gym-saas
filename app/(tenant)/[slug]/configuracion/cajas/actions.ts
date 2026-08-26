"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  createCaja,
  renameCaja,
  desactivarCaja,
  reactivarCaja,
  toggleRequiereCuadre,
} from "@/lib/queries/cajas.queries";

interface SimpleResult {
  ok: boolean;
  error?: string;
}

async function requireOwner() {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "configurar_general")) {
    return { tenant, allowed: false as const };
  }
  return { tenant, allowed: true as const };
}

export async function createCajaAction(nombre: string): Promise<SimpleResult> {
  const { tenant, allowed } = await requireOwner();
  if (!allowed) return { ok: false, error: "Sin permiso." };

  const r = await createCaja(tenant.id, nombre);
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/configuracion/cajas`);
  revalidatePath(`/${tenant.slug}/caja`);
  return { ok: true };
}

export async function renameCajaAction(
  cajaId: string,
  nombre: string
): Promise<SimpleResult> {
  const { tenant, allowed } = await requireOwner();
  if (!allowed) return { ok: false, error: "Sin permiso." };

  const r = await renameCaja(tenant.id, cajaId, nombre);
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/configuracion/cajas`);
  revalidatePath(`/${tenant.slug}/caja`);
  return { ok: true };
}

export async function desactivarCajaAction(cajaId: string): Promise<SimpleResult> {
  const { tenant, allowed } = await requireOwner();
  if (!allowed) return { ok: false, error: "Sin permiso." };

  const r = await desactivarCaja(tenant.id, cajaId);
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/configuracion/cajas`);
  revalidatePath(`/${tenant.slug}/caja`);
  return { ok: true };
}

export async function reactivarCajaAction(cajaId: string): Promise<SimpleResult> {
  const { tenant, allowed } = await requireOwner();
  if (!allowed) return { ok: false, error: "Sin permiso." };

  const r = await reactivarCaja(tenant.id, cajaId);
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/configuracion/cajas`);
  revalidatePath(`/${tenant.slug}/caja`);
  return { ok: true };
}

export async function toggleRequiereCuadreAction(
  cajaId: string,
  requiereCuadre: boolean
): Promise<SimpleResult> {
  const { tenant, allowed } = await requireOwner();
  if (!allowed) return { ok: false, error: "Sin permiso." };

  const r = await toggleRequiereCuadre(tenant.id, cajaId, requiereCuadre);
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/configuracion/cajas`);
  revalidatePath(`/${tenant.slug}/caja`);
  return { ok: true };
}
