"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { autorizarCodigo, rechazarCodigo } from "@/lib/queries/kiosco.queries";

export async function autorizarCodigoAction(
  codigoId: string
): Promise<{ ok: boolean; error?: string; tipo?: "compra" | "membresia" }> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "registrar_pagos")) {
    return { ok: false, error: "No tienes permiso para autorizar cobros." };
  }

  const r = await autorizarCodigo(tenant.id, codigoId);
  if (r.ok) revalidatePath(`/${tenant.slug}`, "layout");
  return r;
}

export async function rechazarCodigoAction(
  codigoId: string
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "registrar_pagos")) {
    return { ok: false, error: "No tienes permiso." };
  }

  const r = await rechazarCodigo(tenant.id, codigoId);
  if (r.ok) revalidatePath(`/${tenant.slug}`, "layout");
  return r;
}
