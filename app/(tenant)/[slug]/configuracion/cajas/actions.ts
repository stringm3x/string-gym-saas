"use server";

import { revalidatePath } from "next/cache";
import { panelAction, type PanelCtx } from "@/lib/authz";
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

function revalidar(tenant: PanelCtx) {
  revalidatePath(`/${tenant.slug}/configuracion/cajas`);
  revalidatePath(`/${tenant.slug}/caja`);
}

export const createCajaAction = panelAction(
  "config.caja_crear",
  {},
  async (tenant, nombre: string): Promise<SimpleResult> => {
    const r = await createCaja(tenant.id, nombre);
    if (!r.ok) return { ok: false, error: r.error };
    revalidar(tenant);
    return { ok: true };
  }
);

export const renameCajaAction = panelAction(
  "config.caja_renombrar",
  {},
  async (tenant, cajaId: string, nombre: string): Promise<SimpleResult> => {
    const r = await renameCaja(tenant.id, cajaId, nombre);
    if (!r.ok) return { ok: false, error: r.error };
    revalidar(tenant);
    return { ok: true };
  }
);

export const desactivarCajaAction = panelAction(
  "config.caja_desactivar",
  {},
  async (tenant, cajaId: string): Promise<SimpleResult> => {
    const r = await desactivarCaja(tenant.id, cajaId);
    if (!r.ok) return { ok: false, error: r.error };
    revalidar(tenant);
    return { ok: true };
  }
);

export const reactivarCajaAction = panelAction(
  "config.caja_reactivar",
  {},
  async (tenant, cajaId: string): Promise<SimpleResult> => {
    const r = await reactivarCaja(tenant.id, cajaId);
    if (!r.ok) return { ok: false, error: r.error };
    revalidar(tenant);
    return { ok: true };
  }
);

export const toggleRequiereCuadreAction = panelAction(
  "config.caja_requiere_cuadre",
  {},
  async (tenant, cajaId: string, requiereCuadre: boolean): Promise<SimpleResult> => {
    const r = await toggleRequiereCuadre(tenant.id, cajaId, requiereCuadre);
    if (!r.ok) return { ok: false, error: r.error };
    revalidar(tenant);
    return { ok: true };
  }
);
