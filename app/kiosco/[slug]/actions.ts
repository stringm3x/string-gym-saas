"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { hasFeature, type Plan } from "@/lib/features";
import { getMiembroByQrToken } from "@/lib/queries/qr.queries";
import { createCheckin } from "@/lib/queries/checkins.queries";

export type KioscoError =
  | "QR_NO_ENCONTRADO"
  | "MIEMBRO_ARCHIVADO"
  | "MEMBRESIA_VENCIDA"
  | "NO_DISPONIBLE"
  | "ERROR";

export type KioscoResult =
  | { success: true; nombre: string; plan: string | null }
  | { success: false; error: KioscoError; nombre?: string };

function hoyYMD(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/**
 * Self check-in público: el miembro escanea su propio QR, sin staff ni sesión.
 * Resuelve el gym por slug (admin client), valida plan Pro+, y registra el
 * check-in si la membresía está vigente. Tenant-scoped por el id del gym.
 */
export async function checkInKioscoAction(
  slug: string,
  token: string
): Promise<KioscoResult> {
  const admin = createAdminClient();

  const { data: gym } = await admin
    .from("gyms")
    .select("id, plan")
    .eq("slug", slug)
    .maybeSingle();
  if (!gym) return { success: false, error: "QR_NO_ENCONTRADO" };
  if (!hasFeature(gym.plan as Plan, "qr_access")) {
    return { success: false, error: "NO_DISPONIBLE" };
  }

  const t = (token || "").trim();
  if (!t) return { success: false, error: "QR_NO_ENCONTRADO" };

  const miembro = await getMiembroByQrToken(gym.id, t, admin);
  if (!miembro) return { success: false, error: "QR_NO_ENCONTRADO" };
  if (miembro.archivado) {
    return { success: false, error: "MIEMBRO_ARCHIVADO", nombre: miembro.nombre };
  }
  if (miembro.fecha_vencimiento && miembro.fecha_vencimiento < hoyYMD()) {
    return { success: false, error: "MEMBRESIA_VENCIDA", nombre: miembro.nombre };
  }

  const res = await createCheckin(gym.id, miembro.id, admin);
  if (!res.ok) {
    return { success: false, error: "ERROR", nombre: miembro.nombre };
  }

  // Nombre del plan (best-effort) para el saludo.
  let plan: string | null = null;
  if (miembro.plan_id) {
    const { data: p } = await admin
      .from("planes_membresia")
      .select("nombre")
      .eq("id", miembro.plan_id)
      .maybeSingle();
    plan = p?.nombre ?? null;
  }

  return { success: true, nombre: miembro.nombre, plan };
}
