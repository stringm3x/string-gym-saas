import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiGuard } from "@/lib/api/guard";
import { apiSuccess, apiError, corsPreflight } from "@/lib/api/response";
import { apiGetMiembroPorTelefono } from "@/lib/api/data";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

/**
 * Miembro por teléfono (bot de WhatsApp). Requiere API key. Matchea por los
 * últimos 10 dígitos de `tel`. Devuelve membresía + próximas reservas.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const g = await apiGuard(request, slug, "/miembro/por-telefono", "GET");
  if (!g.ok) return g.response;

  const tel = request.nextUrl.searchParams.get("tel") ?? "";
  if (tel.replace(/\D/g, "").length < 8) {
    g.log(400);
    return apiError(
      "VALIDATION_ERROR",
      "Parámetro tel requerido (mínimo 8 dígitos).",
      400,
      slug
    );
  }

  const admin = createAdminClient();
  const miembro = await apiGetMiembroPorTelefono(g.ctx.tenantId, tel, admin);
  if (!miembro) {
    g.log(404);
    return apiError(
      "MIEMBRO_NO_ENCONTRADO",
      "No hay un miembro con ese teléfono.",
      404,
      slug
    );
  }

  g.log(200);
  return apiSuccess(miembro, { slug });
}
