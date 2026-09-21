"use server";

import { revalidatePath } from "next/cache";
import { panelAction } from "@/lib/authz";
import { createPlanPago, pagarCuota } from "@/lib/queries/creditos.queries";
import { planPagoInputSchema } from "@/lib/validations/creditos.schema";

const METODOS = ["efectivo", "tarjeta", "transferencia"] as const;
type Metodo = (typeof METODOS)[number];

/** Crea un compromiso de cobro real: mismo permiso que cualquier movimiento de dinero. */
export const crearPlanPagoAction = panelAction(
  "miembros.plan_pago_crear",
  {},
  async (
    tenant,
    input: unknown
  ): Promise<{
    ok: boolean;
    error?: string;
    reciboError?: string;
    cuota1Error?: string;
  }> => {
    const parsed = planPagoInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      };
    }

    const r = await createPlanPago(tenant.id, parsed.data);
    if (!r.ok) return { ok: false, error: r.error };

    revalidatePath(`/${tenant.slug}/miembros/${parsed.data.miembro_id}`);
    return { ok: true, reciboError: r.reciboError, cuota1Error: r.cuota1Error };
  }
);

export const pagarCuotaAction = panelAction(
  "miembros.cuota_pagar",
  {},
  async (
    tenant,
    cuotaId: string,
    metodo: Metodo
  ): Promise<{
    ok: boolean;
    error?: string;
    planCompletado?: boolean;
    reciboError?: string;
  }> => {
    if (!METODOS.includes(metodo)) {
      return { ok: false, error: "Método de pago inválido." };
    }

    const r = await pagarCuota(tenant.id, cuotaId, metodo);
    if (!r.ok) return { ok: false, error: r.error };

    // Revalida ficha del miembro y vista de CxC (ambas dependen de las cuotas).
    revalidatePath(`/${tenant.slug}`, "layout");
    return { ok: true, planCompletado: r.planCompletado, reciboError: r.reciboError };
  }
);
