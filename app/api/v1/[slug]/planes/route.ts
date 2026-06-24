import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiGuard } from "@/lib/api/guard";
import { apiSuccess, corsPreflight } from "@/lib/api/response";
import { listPlanes } from "@/lib/queries/planes.queries";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const g = await apiGuard(request, slug, "/planes", "GET");
  if (!g.ok) return g.response;

  const admin = createAdminClient();
  const planes = await listPlanes(g.ctx.tenantId, { soloActivos: true }, admin);
  const data = planes.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    precio: p.precio,
    duracion_dias: p.dias_duracion,
    descripcion: null,
    activo: p.activo,
  }));

  g.log(200);
  return apiSuccess(data, { slug });
}
