import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasFeature, type Plan } from "@/lib/features";
import { gymOperativo } from "@/lib/utils/gym-operativo";

export interface ApiContext {
  tenantId: string;
  gymSlug: string;
  plan: Plan;
  apiKey: string;
}

export type ApiAuthResult =
  | { ok: true; ctx: ApiContext }
  | {
      ok: false;
      status: number;
      code: "UNAUTHORIZED" | "FORBIDDEN" | "GYM_NO_OPERATIVO";
      message: string;
    };

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
 * - Verifica que el plan del gym incluya la feature `api`: una key creada en
 *   Pro no sigue funcionando si el gym baja a Starter.
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
    .select("tenant_id, gyms(slug, plan, estado, prueba_hasta)")
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

  type GymRow = {
    slug: string;
    plan: string;
    estado: string;
    prueba_hasta: string | null;
  };
  const raw = data.gyms as GymRow | GymRow[] | null;
  const gym = Array.isArray(raw) ? raw[0] : raw;

  if (!gym?.slug || gym.slug !== slug) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "La API key no corresponde a este gym.",
    };
  }

  // Bloque 10: código distinto de FORBIDDEN a propósito — quien integra
  // contra esta API es el propio gym (o su desarrollador), no un socio, así
  // que acá sí es útil decir exactamente por qué, no un mensaje neutral.
  if (!gymOperativo(gym)) {
    return {
      ok: false,
      status: 403,
      code: "GYM_NO_OPERATIVO",
      message: "Este gimnasio no está operativo (prueba vencida o cuenta suspendida).",
    };
  }

  const plan = gym.plan as Plan;
  if (!hasFeature(plan, "api")) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "El plan de este gym no incluye la API.",
    };
  }

  // Actualiza uso sin bloquear la respuesta.
  void admin.rpc("bump_api_key_usage", { p_key: key });

  return {
    ok: true,
    ctx: { tenantId: data.tenant_id, gymSlug: gym.slug, plan, apiKey: key },
  };
}
