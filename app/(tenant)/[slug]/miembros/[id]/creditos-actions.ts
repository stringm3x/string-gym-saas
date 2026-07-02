"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { createPlanPago, pagarCuota } from "@/lib/queries/creditos.queries";
import { planPagoInputSchema } from "@/lib/validations/creditos.schema";

const METODOS = ["efectivo", "tarjeta", "transferencia"] as const;
type Metodo = (typeof METODOS)[number];

export async function crearPlanPagoAction(
  input: unknown
): Promise<{ ok: boolean; error?: string }> {
  const tenant = await getTenant();
  if (!hasFeature(tenant.plan, "creditos")) {
    return { ok: false, error: "Tu plan no incluye Créditos." };
  }

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
  return { ok: true };
}

export async function pagarCuotaAction(
  cuotaId: string,
  metodo: Metodo
): Promise<{ ok: boolean; error?: string; planCompletado?: boolean }> {
  const tenant = await getTenant();
  if (!hasFeature(tenant.plan, "creditos")) {
    return { ok: false, error: "Tu plan no incluye Créditos." };
  }
  if (!METODOS.includes(metodo)) {
    return { ok: false, error: "Método de pago inválido." };
  }

  const r = await pagarCuota(tenant.id, cuotaId, metodo);
  if (!r.ok) return { ok: false, error: r.error };

  // Revalida ficha del miembro y vista de CxC (ambas dependen de las cuotas).
  revalidatePath(`/${tenant.slug}`, "layout");
  return { ok: true, planCompletado: r.planCompletado };
}
