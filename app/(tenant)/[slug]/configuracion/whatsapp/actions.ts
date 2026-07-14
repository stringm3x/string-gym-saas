"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import {
  getWhatsappConfig,
  updateWhatsappConfig,
} from "@/lib/queries/gyms.queries";
import { whatsappConfigSchema } from "@/lib/validations/whatsapp-config.schema";

export interface WhatsappConfigFormState {
  ok: boolean;
  error: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

const empty: WhatsappConfigFormState = { ok: false, error: null, fieldErrors: {} };

export async function updateWhatsappConfigAction(
  _prev: WhatsappConfigFormState,
  formData: FormData
): Promise<WhatsappConfigFormState> {
  const tenant = await getTenant();
  if (!hasFeature(tenant.plan, "whatsapp_automatico")) {
    return { ...empty, error: "Tu plan no incluye WhatsApp." };
  }
  if (!hasPermission(tenant.role, "configurar_general")) {
    return { ...empty, error: "No tienes permiso para esta acción." };
  }

  const parsed = whatsappConfigSchema.safeParse({
    activo: formData.get("activo") === "true",
    numero: String(formData.get("numero") ?? ""),
    api_key: String(formData.get("api_key") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      const path = key !== undefined ? String(key) : undefined;
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }

  const numero = (parsed.data.numero ?? "").trim();
  const apiKey = (parsed.data.api_key ?? "").trim();

  // Para activar hacen falta número + API key (nueva o ya guardada).
  if (parsed.data.activo) {
    const actual = await getWhatsappConfig(tenant.id);
    if (!numero) {
      return {
        ok: false,
        error: "Agrega el número de WhatsApp antes de activar.",
        fieldErrors: { numero: "Requerido para activar" },
      };
    }
    if (!apiKey && !actual.apiKeySet) {
      return {
        ok: false,
        error: "Agrega la API key de 360dialog antes de activar.",
        fieldErrors: { api_key: "Requerida para activar" },
      };
    }
  }

  const result = await updateWhatsappConfig(tenant.id, {
    activo: parsed.data.activo,
    numero: numero || null,
    apiKey: apiKey || undefined,
  });
  if (!result.ok) return { ...empty, error: result.error };

  revalidatePath(`/${tenant.slug}/configuracion/whatsapp`);
  return { ok: true, error: null, fieldErrors: {} };
}
