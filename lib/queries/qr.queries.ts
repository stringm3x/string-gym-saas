import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface MiembroQrPublic {
  nombre: string;
  fecha_vencimiento: string | null;
  qr_token: string;
  archivado: boolean;
  gym: {
    slug: string;
    nombre: string;
    logo_url: string | null;
    color_acento: string | null;
  } | null;
}

/**
 * Lookup GLOBAL por token (página pública /qr/[token], sin auth ni tenant).
 * Usa admin client porque la página no tiene sesión. Solo expone datos no
 * sensibles (nombre, vencimiento, gym).
 */
export async function getMiembroByQrTokenPublic(
  token: string
): Promise<MiembroQrPublic | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("miembros")
    .select(
      "nombre, fecha_vencimiento, qr_token, archivado, gym:gyms(slug, nombre, logo_url, color_acento)"
    )
    .eq("qr_token", token)
    .maybeSingle();
  if (!data) return null;
  return data as unknown as MiembroQrPublic;
}

export interface MiembroQrScan {
  id: string;
  nombre: string;
  telefono: string | null;
  fecha_vencimiento: string | null;
  archivado: boolean;
  plan_id: string | null;
}

/**
 * Lookup acotado por tenant (scanner del staff). Tenant isolation: un token
 * de gym A no se encuentra al escanear en gym B.
 */
export async function getMiembroByQrToken(
  tenantId: string,
  token: string,
  client?: SupabaseClient
): Promise<MiembroQrScan | null> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("miembros")
    .select("id, nombre, telefono, fecha_vencimiento, archivado, plan_id")
    .eq("tenant_id", tenantId)
    .eq("qr_token", token)
    .maybeSingle();
  return (data as MiembroQrScan | null) ?? null;
}

/** Regenera el token del miembro (el anterior deja de funcionar). */
export async function regenerarQrToken(
  tenantId: string,
  miembroId: string
): Promise<{ ok: boolean; token?: string; error?: string }> {
  const supabase = await createClient();
  const token = randomBytes(16).toString("hex");
  const { data, error } = await supabase
    .from("miembros")
    .update({ qr_token: token, qr_generado_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", miembroId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Miembro no encontrado." };
  return { ok: true, token };
}

export interface MiembroQrData {
  qr_token: string;
  nombre: string;
  fecha_vencimiento: string | null;
}

/** Datos del QR para la ficha del miembro (admin). */
export async function getMiembroQrData(
  tenantId: string,
  miembroId: string
): Promise<MiembroQrData | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("miembros")
    .select("qr_token, nombre, fecha_vencimiento")
    .eq("tenant_id", tenantId)
    .eq("id", miembroId)
    .maybeSingle();
  return (data as MiembroQrData | null) ?? null;
}
