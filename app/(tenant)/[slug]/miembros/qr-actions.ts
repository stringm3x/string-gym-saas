"use server";

import { revalidatePath } from "next/cache";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { regenerarQrToken } from "@/lib/queries/qr.queries";

export interface QrActionResult {
  ok: boolean;
  error?: string;
}

/** Regenera el QR de un miembro. Owner only + feature qr_access. */
export async function regenerarQrAction(
  miembroId: string
): Promise<QrActionResult> {
  const tenant = await getTenant();
  if (tenant.role !== "owner" || !hasFeature(tenant.plan, "qr_access")) {
    return { ok: false, error: "No autorizado." };
  }

  const r = await regenerarQrToken(tenant.id, miembroId);
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
  return { ok: true };
}
