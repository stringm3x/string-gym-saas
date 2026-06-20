"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
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

export async function createPromocionAction(
  _prev: PromocionFormState,
  formData: FormData
): Promise<PromocionFormState> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "configurar_planes_promociones")) {
    return { ...empty, error: "No tienes permiso para esta acción." };
  }
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

export async function updatePromocionAction(
  id: string,
  _prev: PromocionFormState,
  formData: FormData
): Promise<PromocionFormState> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "configurar_planes_promociones")) {
    return { ...empty, error: "No tienes permiso para esta acción." };
  }
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

export async function togglePromocionAction(id: string, activo: boolean) {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "configurar_planes_promociones")) {
    return { ok: false as const, error: "No tienes permiso para esta acción." };
  }
  const result = await togglePromocionActiva(tenant.id, id, activo);
  if (result.ok) {
    revalidatePath(`/${tenant.slug}/configuracion/promociones`);
  }
  return result;
}
