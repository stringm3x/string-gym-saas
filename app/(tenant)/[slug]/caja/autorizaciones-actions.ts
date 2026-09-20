"use server";

import { revalidatePath } from "next/cache";
import { panelAction } from "@/lib/authz";
import { autorizarCodigo, rechazarCodigo } from "@/lib/queries/kiosco.queries";

export const autorizarCodigoAction = panelAction(
  "caja.autorizar_codigo",
  {},
  async (
    tenant,
    codigoId: string
  ): Promise<{ ok: boolean; error?: string; tipo?: "compra" | "membresia" }> => {
    const r = await autorizarCodigo(tenant.id, codigoId);
    if (r.ok) revalidatePath(`/${tenant.slug}`, "layout");
    return r;
  }
);

export const rechazarCodigoAction = panelAction(
  "caja.rechazar_codigo",
  {},
  async (tenant, codigoId: string): Promise<{ ok: boolean; error?: string }> => {
    const r = await rechazarCodigo(tenant.id, codigoId);
    if (r.ok) revalidatePath(`/${tenant.slug}`, "layout");
    return r;
  }
);
