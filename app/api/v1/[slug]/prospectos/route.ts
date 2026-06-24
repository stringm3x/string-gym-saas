import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiGuard } from "@/lib/api/guard";
import { apiSuccess, apiError, corsPreflight } from "@/lib/api/response";
import { apiProspectoSchema, primerError } from "@/lib/validations/api.schema";
import { apiCreateProspecto } from "@/lib/api/data";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const g = await apiGuard(request, slug, "/prospectos", "POST");
  if (!g.ok) return g.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    g.log(400);
    return apiError("VALIDATION_ERROR", "Cuerpo JSON inválido.", 400, slug);
  }

  const parsed = apiProspectoSchema.safeParse(body);
  if (!parsed.success) {
    g.log(400);
    return apiError("VALIDATION_ERROR", primerError(parsed.error), 400, slug);
  }
  const input = parsed.data;

  const admin = createAdminClient();
  const { id, error } = await apiCreateProspecto(
    g.ctx.tenantId,
    {
      nombre: input.nombre,
      telefono: input.telefono,
      email: input.email || undefined,
      mensaje: input.mensaje,
      origenDetalle: input.origen_detalle,
    },
    admin
  );
  if (!id) {
    g.log(500);
    return apiError(
      "INTERNAL_ERROR",
      "No se pudo crear el prospecto." + (error ? ` (${error})` : ""),
      500,
      slug
    );
  }

  g.log(201);
  return apiSuccess(
    { prospecto_id: id, mensaje: "¡Gracias! Te contactaremos pronto." },
    { slug, status: 201 }
  );
}
