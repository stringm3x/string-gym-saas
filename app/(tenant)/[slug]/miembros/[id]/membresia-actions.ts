"use server";

import { revalidatePath } from "next/cache";
import { panelAction } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
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

export const congelarMembresiaAction = panelAction(
  "miembros.congelar",
  {},
  async (
    tenant,
    miembroId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<{ ok: boolean; error?: string }> => {
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
);

export const descongelarMembresiaAction = panelAction(
  "miembros.descongelar",
  {},
  async (tenant, miembroId: string): Promise<{ ok: boolean; error?: string }> => {
    const { userId, nombre } = await quienSoy(tenant.id);
    const r = await descongelarMembresia(tenant.id, miembroId, {
      userId,
      nombre,
    });
    if (!r.ok) return { ok: false, error: r.error };

    revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
    return { ok: true };
  }
);

export const aprobarCongelacionAction = panelAction(
  "miembros.aprobar_congelacion",
  {},
  async (tenant, miembroId: string, eventoId: string): Promise<{ ok: boolean; error?: string }> => {
    const r = await aprobarCongelacion(tenant.id, eventoId);
    if (!r.ok) return { ok: false, error: r.error };
    revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
    return { ok: true };
  }
);

export const rechazarCongelacionAction = panelAction(
  "miembros.rechazar_congelacion",
  {},
  async (tenant, miembroId: string, eventoId: string): Promise<{ ok: boolean; error?: string }> => {
    const r = await rechazarCongelacion(tenant.id, eventoId);
    if (!r.ok) return { ok: false, error: r.error };
    revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
    return { ok: true };
  }
);

/**
 * Previsualiza el prorrateo de un cambio de plan (sin escribir nada): el
 * cajero debe ver la cuenta — días restantes, valor, días del plan nuevo,
 * saldo a favor si lo hay — antes de poder confirmar.
 */
export const previsualizarCambioPlanAction = panelAction(
  "miembros.previsualizar_cambio_plan",
  {},
  async (
    tenant,
    miembroId: string,
    nuevoPlanId: string
  ): Promise<{ ok: true; calculo: CambioPlanCalculo } | { ok: false; error: string }> => {
    if (!nuevoPlanId) return { ok: false, error: "Elige un plan." };
    return calcularCambioPlan(tenant.id, miembroId, nuevoPlanId);
  }
);

/**
 * Cambia el plan del socio prorrateando. Puede mover dinero (nota de
 * crédito), por eso exige el mismo permiso que cobrar: un rol sin acceso a
 * caja no debe poder regalar ni quitar días de vigencia.
 */
export const cambiarPlanAction = panelAction(
  "miembros.cambiar_plan",
  {},
  async (
    tenant,
    miembroId: string,
    nuevoPlanId: string
  ): Promise<{ ok: boolean; error?: string; notaCredito?: number }> => {
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
);
