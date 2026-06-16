import { createClient } from "@/lib/supabase/server";
import type { GymConfigInput } from "@/lib/validations/gym.schema";

export interface GymInfo {
  id: string;
  slug: string;
  nombre: string;
  logo_url: string | null;
}

export interface GymFull extends GymInfo {
  telefono: string | null;
  direccion: string | null;
  rfc: string | null;
}

/**
 * Obtiene los datos básicos del gym por su tenant_id.
 * RLS ya garantiza que solo se puede leer el gym del owner autenticado.
 */
export async function getGymInfo(tenantId: string): Promise<GymInfo | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gyms")
    .select("id, slug, nombre, logo_url")
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
    .select("id, slug, nombre, logo_url, telefono, direccion, rfc")
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
    })
    .eq("id", tenantId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
