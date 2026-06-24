import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { apiSuccess, apiError, corsPreflight } from "@/lib/api/response";
import { logApiRequest, clientIp } from "@/lib/api/log";
import { apiGetGymPublic } from "@/lib/api/data";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

/** Pública: no requiere API key, solo un slug válido. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const admin = createAdminClient();
  const gym = await apiGetGymPublic(slug, admin);
  if (!gym) {
    return apiError("NOT_FOUND", "Gym no encontrado.", 404, slug);
  }

  const ip = clientIp(request);
  // Sin API key: limitamos por slug.
  const { allowed } = checkRateLimit(`info:${slug}`);
  if (!allowed) {
    logApiRequest({
      tenantId: gym.id,
      endpoint: "/info",
      method: "GET",
      statusCode: 429,
      ip,
    });
    return apiError(
      "RATE_LIMITED",
      "Límite de 100 requests por minuto excedido.",
      429,
      slug
    );
  }

  logApiRequest({
    tenantId: gym.id,
    endpoint: "/info",
    method: "GET",
    statusCode: 200,
    ip,
  });
  return apiSuccess(
    {
      nombre: gym.nombre,
      slug: gym.slug,
      logo_url: gym.logo_url,
      color_acento: gym.color_acento,
      direccion: gym.direccion,
      telefono: gym.telefono,
      whatsapp: null,
      horarios: null,
    },
    { slug }
  );
}
