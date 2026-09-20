"use server";

import { revalidatePath } from "next/cache";
import { panelAction } from "@/lib/authz";
import { regenerarQrToken } from "@/lib/queries/qr.queries";

export interface QrActionResult {
  ok: boolean;
  error?: string;
}

/** Regenera el QR de un miembro (invalida el anterior). */
export const regenerarQrAction = panelAction(
  "miembros.regenerar_qr",
  {},
  async (tenant, miembroId: string): Promise<QrActionResult> => {
    const r = await regenerarQrToken(tenant.id, miembroId);
    if (!r.ok) return { ok: false, error: r.error };

    revalidatePath(`/${tenant.slug}/miembros/${miembroId}`);
    return { ok: true };
  }
);
