import { createClient } from "@/lib/supabase/server";
import type { GymConfigInput } from "@/lib/validations/gym.schema";

export interface GymInfo {
  id: string;
  slug: string;
  nombre: string;
  logo_url: string | null;
  /** Timestamp de aceptación de Términos (Fase 7.3); null si aún no acepta. */
  acepto_terminos_at?: string | null;
  /** Guía de primer acceso completada (Fase P.1). */
  onboarding_completado?: boolean;
}

export interface GymFull extends GymInfo {
  telefono: string | null;
  direccion: string | null;
  rfc: string | null;
  checkin_bloquea_vencidos: boolean;
}

/**
 * Obtiene los datos básicos del gym por su tenant_id.
 * RLS ya garantiza que solo se puede leer el gym del owner autenticado.
 */
export async function getGymInfo(tenantId: string): Promise<GymInfo | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gyms")
    .select("id, slug, nombre, logo_url, acepto_terminos_at, onboarding_completado")
    .eq("id", tenantId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getGymFull(tenantId: string): Promise<GymFull | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gyms")
    .select(
      "id, slug, nombre, logo_url, telefono, direccion, rfc, checkin_bloquea_vencidos"
    )
    .eq("id", tenantId)
    .single();

  if (error || !data) return null;
  return data as GymFull;
}

export async function updateGymConfig(
  tenantId: string,
  input: GymConfigInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("gyms")
    .update({
      nombre: input.nombre,
      telefono: input.telefono ?? null,
      direccion: input.direccion ?? null,
      rfc: input.rfc ?? null,
      checkin_bloquea_vencidos: input.checkin_bloquea_vencidos,
    })
    .eq("id", tenantId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface WhatsappConfig {
  activo: boolean;
  numero: string | null;
  /** true si hay API key guardada. Nunca se re-expone la key en sí. */
  apiKeySet: boolean;
}

/** Estado de la config de WhatsApp del gym (sin exponer la API key). */
export async function getWhatsappConfig(
  tenantId: string
): Promise<WhatsappConfig> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gyms")
    .select("whatsapp_activo, whatsapp_numero, whatsapp_api_key")
    .eq("id", tenantId)
    .single();
  return {
    activo: !!data?.whatsapp_activo,
    numero: (data?.whatsapp_numero as string | null) ?? null,
    apiKeySet: !!data?.whatsapp_api_key,
  };
}

/**
 * Actualiza la config de WhatsApp. La API key solo se escribe si viene un valor
 * nuevo (blanco = conservar la existente).
 */
export async function updateWhatsappConfig(
  tenantId: string,
  input: { activo: boolean; numero: string | null; apiKey?: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const payload: Record<string, unknown> = {
    whatsapp_activo: input.activo,
    whatsapp_numero: input.numero,
  };
  if (input.apiKey) payload.whatsapp_api_key = input.apiKey;

  const { error } = await supabase
    .from("gyms")
    .update(payload)
    .eq("id", tenantId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Máximo de no-shows (30 días) antes de bloquear reservas. 0 = desactivado. */
export async function getClasesMaxNoshows(tenantId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gyms")
    .select("clases_max_noshows")
    .eq("id", tenantId)
    .maybeSingle();
  return Number(data?.clases_max_noshows ?? 0);
}

export async function updateClasesMaxNoshows(
  tenantId: string,
  max: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("gyms")
    .update({ clases_max_noshows: max })
    .eq("id", tenantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Marca la aceptación de Términos del gym (Fase 7.3). Idempotente: solo
 * escribe si aún no había aceptado, para conservar el timestamp original.
 */
export async function aceptarTerminos(
  tenantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("gyms")
    .update({ acepto_terminos_at: new Date().toISOString() })
    .eq("id", tenantId)
    .is("acepto_terminos_at", null);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
