"use server";

import { revalidatePath } from "next/cache";
import { panelAction } from "@/lib/authz";
import { regenerarApiKey } from "@/lib/queries/api-keys.queries";

export interface RegenerarResult {
  ok: boolean;
  apiKey?: string;
  error?: string;
}

export const regenerarApiKeyAction = panelAction(
  "config.api_regenerar",
  {},
  async (tenant): Promise<RegenerarResult> => {
    const r = await regenerarApiKey(tenant.id);
    if (!r.ok) return { ok: false, error: r.error };

    revalidatePath(`/${tenant.slug}/configuracion/api`);
    return { ok: true, apiKey: r.apiKey };
  }
);
