"use server";

import { revalidatePath } from "next/cache";
import { panelAction, type Denegado } from "@/lib/authz";
import {
  createPromocion,
  updatePromocion,
  togglePromocionActiva,
} from "@/lib/queries/promociones.queries";
import { promocionSchema } from "@/lib/validations/promocion.schema";

export interface PromocionFormState {
  ok: boolean;
  error: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

const empty: PromocionFormState = { ok: false, error: null, fieldErrors: {} };
const denegar = (d: Denegado): PromocionFormState => ({ ...empty, error: d.error });

function parse(formData: FormData) {
  const diasRaw = formData.get("dias_duracion");
  return {
    nombre: String(formData.get("nombre") ?? ""),
    tipo: String(formData.get("tipo") ?? "membresia") as
      | "membresia"
      | "producto",
    precio: Number(formData.get("precio") ?? 0),
    dias_duracion: diasRaw && String(diasRaw).trim() ? Number(diasRaw) : null,
    vigencia_desde: String(formData.get("vigencia_desde") ?? ""),
    vigencia_hasta: String(formData.get("vigencia_hasta") ?? ""),
  };
}

export const createPromocionAction = panelAction(
  "config.promocion_crear",
  { onDenied: denegar },
  async (tenant, _prev: PromocionFormState, formData: FormData): Promise<PromocionFormState> => {
    const raw = parse(formData);
    const parsed = promocionSchema.safeParse(raw);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0]?.toString();
        if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      return { ok: false, error: "Revisa los campos.", fieldErrors };
    }

    const result = await createPromocion(tenant.id, parsed.data);
    if (!result.ok) return { ...empty, error: result.error };

    revalidatePath(`/${tenant.slug}/configuracion/promociones`);
    return { ok: true, error: null, fieldErrors: {} };
  }
);

export const updatePromocionAction = panelAction(
  "config.promocion_editar",
  { onDenied: denegar },
  async (
    tenant,
    id: string,
    _prev: PromocionFormState,
    formData: FormData
  ): Promise<PromocionFormState> => {
    const raw = parse(formData);
    const parsed = promocionSchema.safeParse(raw);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0]?.toString();
        if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      return { ok: false, error: "Revisa los campos.", fieldErrors };
    }

    const result = await updatePromocion(tenant.id, id, parsed.data);
    if (!result.ok) return { ...empty, error: result.error };

    revalidatePath(`/${tenant.slug}/configuracion/promociones`);
    return { ok: true, error: null, fieldErrors: {} };
  }
);

export const togglePromocionAction = panelAction(
  "config.promocion_toggle",
  {},
  async (tenant, id: string, activo: boolean): Promise<{ ok: boolean; error?: string }> => {
    const result = await togglePromocionActiva(tenant.id, id, activo);
    if (result.ok) {
      revalidatePath(`/${tenant.slug}/configuracion/promociones`);
    }
    return result;
  }
);
