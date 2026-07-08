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
  | {
      success: true;
      nombre: string;
      plan: string | null;
      miembroId: string;
      /** true si el miembro no tiene teléfono usable (para pedirlo). */
      sinContacto: boolean;
    }
  | { success: false; error: KioscoError; nombre?: string };

/** Teléfono ausente o placeholder → conviene pedirlo. */
function sinTelefono(tel: string | null): boolean {
  const t = (tel ?? "").replace(/\D/g, "");
  return t.length === 0 || t === "0000000000";
}

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

  return {
    success: true,
    nombre: miembro.nombre,
    plan,
    miembroId: miembro.id,
    sinContacto: sinTelefono(miembro.telefono),
  };
}

/**
 * Actualiza el teléfono de un miembro desde el kiosco (público, sin sesión).
 * Scoped por gym (slug) + id del miembro. No lanza; valida 10 dígitos.
 */
export async function actualizarTelefonoKioscoAction(
  slug: string,
  miembroId: string,
  telefono: string
): Promise<{ ok: boolean; error?: string }> {
  const digits = (telefono || "").replace(/\D/g, "");
  if (digits.length !== 10) {
    return { ok: false, error: "Escribe un número de 10 dígitos." };
  }

  const admin = createAdminClient();
  const { data: gym } = await admin
    .from("gyms")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!gym) return { ok: false, error: "Gimnasio no encontrado." };

  const { error } = await admin
    .from("miembros")
    .update({ telefono: digits })
    .eq("tenant_id", gym.id)
    .eq("id", miembroId);
  if (error) return { ok: false, error: "No se pudo guardar." };
  return { ok: true };
}
