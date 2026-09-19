import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_COLOR_ACENTO,
  DEFAULT_COLOR_SIDEBAR,
  DEFAULT_COLOR_FONDO,
} from "@/lib/validations/marca.schema";

// La única policy de UPDATE sobre `gyms` es `owner_id = auth.uid()`: para
// un gerente estos updates afectan 0 filas sin `error` (ver el mismo
// comentario en gyms.queries.ts). Sin `.select()` para contarlas, la UI
// mostraba éxito sobre un cambio que nunca se guardó.
const ERROR_SOLO_OWNER =
  "No se guardó: por ahora solo el dueño puede cambiar esto.";

export interface GymMarca {
  id: string;
  logo_url: string | null;
  color_acento: string;
  color_sidebar: string;
  color_fondo: string;
  favicon_url: string | null;
}

export async function getGymMarca(tenantId: string): Promise<GymMarca | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gyms")
    .select("id, logo_url, color_acento, color_sidebar, color_fondo, favicon_url")
    .eq("id", tenantId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    logo_url: data.logo_url ?? null,
    color_acento: data.color_acento ?? DEFAULT_COLOR_ACENTO,
    color_sidebar: data.color_sidebar ?? DEFAULT_COLOR_SIDEBAR,
    color_fondo: data.color_fondo ?? DEFAULT_COLOR_FONDO,
    favicon_url: data.favicon_url ?? null,
  };
}

export async function updateGymMarca(
  tenantId: string,
  data: Partial<Pick<GymMarca, "color_acento" | "color_sidebar" | "color_fondo">>
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("gyms")
    .update(data)
    .eq("id", tenantId)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!rows || rows.length === 0) return { ok: false, error: ERROR_SOLO_OWNER };
  return { ok: true };
}

export async function updateGymLogo(
  tenantId: string,
  logoUrl: string | null
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gyms")
    .update({ logo_url: logoUrl })
    .eq("id", tenantId)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: ERROR_SOLO_OWNER };
  return { ok: true };
}
