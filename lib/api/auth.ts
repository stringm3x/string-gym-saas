import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ApiContext {
  tenantId: string;
  gymSlug: string;
  apiKey: string;
}

export type ApiAuthResult =
  | { ok: true; ctx: ApiContext }
  | { ok: false; status: number; code: "UNAUTHORIZED" | "FORBIDDEN"; message: string };

/** Prefijo de las API keys de STRING gym. */
export const API_KEY_PREFIX = "sgk_";

/** Lee la API key del header Authorization: Bearer o del query param api_key. */
function extractKey(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const k = auth.slice(7).trim();
    if (k) return k;
  }
  const qp = request.nextUrl.searchParams.get("api_key");
  return qp?.trim() || null;
}

/**
 * Autentica una request de la API pública contra el `slug` de la URL.
 *
 * - Usa service-role (bypassa RLS) para validar la key.
 * - Verifica que la key esté activa y que su gym coincida con el slug del URL
 *   (evita usar la key de un gym para pedir datos de otro).
 * - Actualiza ultimo_uso + requests_totales (fire-and-forget).
 */
export async function authenticateApiKey(
  request: NextRequest,
  slug: string
): Promise<ApiAuthResult> {
  const key = extractKey(request);
  if (!key) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Falta la API key. Usa el header Authorization: Bearer sgk_…",
    };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("gym_api_keys")
    .select("tenant_id, gyms(slug)")
    .eq("api_key", key)
    .eq("activa", true)
    .maybeSingle();

  if (!data) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "API key inválida o inactiva.",
    };
  }

  const gym = data.gyms as { slug: string } | { slug: string }[] | null;
  const gymSlug = Array.isArray(gym) ? gym[0]?.slug : gym?.slug;

  if (!gymSlug || gymSlug !== slug) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "La API key no corresponde a este gym.",
    };
  }

  // Actualiza uso sin bloquear la respuesta.
  void admin.rpc("bump_api_key_usage", { p_key: key });

  return {
    ok: true,
    ctx: { tenantId: data.tenant_id, gymSlug, apiKey: key },
  };
}
