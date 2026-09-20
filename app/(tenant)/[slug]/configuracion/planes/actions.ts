"use server";

import { revalidatePath } from "next/cache";
import { panelAction, type Denegado } from "@/lib/authz";
import {
  createPlan,
  updatePlan,
  togglePlanActivo,
} from "@/lib/queries/planes.queries";
import { planMembresiaSchema } from "@/lib/validations/plan-membresia.schema";

export interface PlanFormState {
  ok: boolean;
  error: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

const empty: PlanFormState = { ok: false, error: null, fieldErrors: {} };
const denegar = (d: Denegado): PlanFormState => ({ ...empty, error: d.error });

function parse(formData: FormData) {
  const visitasRaw = formData.get("visitas");
  return {
    nombre: String(formData.get("nombre") ?? ""),
    precio: Number(formData.get("precio") ?? 0),
    dias_duracion: Number(formData.get("dias_duracion") ?? 0),
    tipo: (String(formData.get("tipo") ?? "tiempo") || "tiempo") as
      | "tiempo"
      | "visitas"
      | "paquete",
    visitas:
      visitasRaw && String(visitasRaw).trim()
        ? Number(visitasRaw)
        : null,
  };
}

export const createPlanAction = panelAction(
  "config.plan_crear",
  { onDenied: denegar },
  async (tenant, _prev: PlanFormState, formData: FormData): Promise<PlanFormState> => {
    const raw = parse(formData);
    const parsed = planMembresiaSchema.safeParse(raw);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0]?.toString();
        if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      return { ok: false, error: "Revisa los campos.", fieldErrors };
    }

    const result = await createPlan(tenant.id, parsed.data);
    if (!result.ok) return { ...empty, error: result.error };

    revalidatePath(`/${tenant.slug}/configuracion/planes`);
    return { ok: true, error: null, fieldErrors: {} };
  }
);

export const updatePlanAction = panelAction(
  "config.plan_editar",
  { onDenied: denegar },
  async (
    tenant,
    id: string,
    _prev: PlanFormState,
    formData: FormData
  ): Promise<PlanFormState> => {
    const raw = parse(formData);
    const parsed = planMembresiaSchema.safeParse(raw);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0]?.toString();
        if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      return { ok: false, error: "Revisa los campos.", fieldErrors };
    }

    const result = await updatePlan(tenant.id, id, parsed.data);
    if (!result.ok) return { ...empty, error: result.error };

    revalidatePath(`/${tenant.slug}/configuracion/planes`);
    return { ok: true, error: null, fieldErrors: {} };
  }
);

export const togglePlanAction = panelAction(
  "config.plan_toggle",
  {},
  async (tenant, id: string, activo: boolean): Promise<{ ok: boolean; error?: string }> => {
    const result = await togglePlanActivo(tenant.id, id, activo);
    if (result.ok) {
      revalidatePath(`/${tenant.slug}/configuracion/planes`);
    }
    return result;
  }
);
