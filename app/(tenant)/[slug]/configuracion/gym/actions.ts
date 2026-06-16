"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { updateGymConfig } from "@/lib/queries/gyms.queries";
import { gymConfigSchema } from "@/lib/validations/gym.schema";

export interface GymConfigFormState {
  ok: boolean;
  error: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

const empty: GymConfigFormState = { ok: false, error: null, fieldErrors: {} };

export async function updateGymConfigAction(
  _prev: GymConfigFormState,
  formData: FormData
): Promise<GymConfigFormState> {
  const tenant = await getTenant();

  const raw = {
    nombre: String(formData.get("nombre") ?? ""),
    telefono: String(formData.get("telefono") ?? ""),
    direccion: String(formData.get("direccion") ?? ""),
    rfc: String(formData.get("rfc") ?? ""),
  };

  const parsed = gymConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      const path = key !== undefined ? String(key) : undefined;
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }

  const result = await updateGymConfig(tenant.id, parsed.data);
  if (!result.ok) return { ...empty, error: result.error };

  revalidatePath(`/${tenant.slug}/configuracion/gym`);
  return { ok: true, error: null, fieldErrors: {} };
}
