"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { hasFeature } from "@/lib/features";
import { regenerarApiKey } from "@/lib/queries/api-keys.queries";

export interface RegenerarResult {
  ok: boolean;
  apiKey?: string;
  error?: string;
}

export async function regenerarApiKeyAction(): Promise<RegenerarResult> {
  const tenant = await getTenant();
  if (
    !hasPermission(tenant.role, "configurar_general") ||
    !hasFeature(tenant.plan, "api")
  ) {
    return { ok: false, error: "No autorizado." };
  }

  const r = await regenerarApiKey(tenant.id);
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/configuracion/api`);
  return { ok: true, apiKey: r.apiKey };
}
