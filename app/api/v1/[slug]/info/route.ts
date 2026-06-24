import type { NextRequest } from "next/server";
import { apiPublicGuard } from "@/lib/api/guard";
import { apiSuccess, corsPreflight } from "@/lib/api/response";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

/** Pública: info del gym, no requiere API key. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const g = await apiPublicGuard(request, slug, "/info", "GET");
  if (!g.ok) return g.response;

  g.log(200);
  return apiSuccess(
    {
      nombre: g.gym.nombre,
      slug: g.gym.slug,
      logo_url: g.gym.logo_url,
      color_acento: g.gym.color_acento,
      direccion: g.gym.direccion,
      telefono: g.gym.telefono,
      whatsapp: null,
      horarios: null,
    },
    { slug }
  );
}
