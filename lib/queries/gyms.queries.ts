import { createClient } from "@/lib/supabase/server";

export interface GymInfo {
  id: string;
  slug: string;
  nombre: string;
  logo_url: string | null;
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
