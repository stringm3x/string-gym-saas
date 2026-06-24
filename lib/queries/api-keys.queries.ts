import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export interface ApiKeyInfo {
  api_key: string;
  ultimo_uso: string | null;
  requests_totales: number;
  created_at: string;
}

export interface ApiLogRow {
  id: string;
  endpoint: string;
  method: string;
  status_code: number;
  created_at: string;
}

const KEY_COLS = "api_key, ultimo_uso, requests_totales, created_at";

/** Genera una API key con el prefijo de STRING. */
function nuevaKey(): string {
  return "sgk_" + randomBytes(32).toString("hex");
}

/**
 * Obtiene la API key del gym, creándola si aún no existe.
 * Usa el client de sesión: la policy owner_access_api_keys (user_gym_ids)
 * permite al owner ver/crear su propia key.
 */
export async function getOrCreateApiKey(
  tenantId: string
): Promise<ApiKeyInfo | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("gym_api_keys")
    .select(KEY_COLS)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (data) return data as ApiKeyInfo;

  const { data: created, error } = await supabase
    .from("gym_api_keys")
    .insert({ tenant_id: tenantId, api_key: nuevaKey() })
    .select(KEY_COLS)
    .single();
  if (error || !created) return null;
  return created as ApiKeyInfo;
}

/** Regenera la API key (la anterior deja de funcionar). */
export async function regenerarApiKey(
  tenantId: string
): Promise<{ ok: boolean; apiKey?: string; error?: string }> {
  const supabase = await createClient();
  const key = nuevaKey();

  const { data, error } = await supabase
    .from("gym_api_keys")
    .update({ api_key: key, ultimo_uso: null, requests_totales: 0 })
    .eq("tenant_id", tenantId)
    .select("api_key")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  // Si no existía aún, crearla.
  if (!data) {
    const { error: insErr } = await supabase
      .from("gym_api_keys")
      .insert({ tenant_id: tenantId, api_key: key });
    if (insErr) return { ok: false, error: insErr.message };
  }

  return { ok: true, apiKey: key };
}

/** Últimas N requests de la API del gym. */
export async function getApiLog(
  tenantId: string,
  limit = 20
): Promise<ApiLogRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("api_requests_log")
    .select("id, endpoint, method, status_code, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ApiLogRow[];
}

/** Total de requests de los últimos 30 días. */
export async function countRequestsUltimoMes(
  tenantId: string
): Promise<number> {
  const supabase = await createClient();
  const desde = new Date();
  desde.setDate(desde.getDate() - 30);
  const { count } = await supabase
    .from("api_requests_log")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", desde.toISOString());
  return count ?? 0;
}
