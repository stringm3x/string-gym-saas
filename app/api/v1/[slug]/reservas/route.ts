import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiGuard } from "@/lib/api/guard";
import { apiSuccess, apiError, corsPreflight } from "@/lib/api/response";
import { apiReservaSchema, primerError } from "@/lib/validations/api.schema";
import { getSesionById } from "@/lib/queries/clases.queries";
import { reservarConCupo } from "@/lib/utils/clases-cupo";
import { crearProspectoDesdeClaseGratis } from "@/lib/utils/clases-prospecto";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const g = await apiGuard(request, slug, "/reservas", "POST");
  if (!g.ok) return g.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    g.log(400);
    return apiError("VALIDATION_ERROR", "Cuerpo JSON inválido.", 400, slug);
  }

  const parsed = apiReservaSchema.safeParse(body);
  if (!parsed.success) {
    g.log(400);
    return apiError("VALIDATION_ERROR", primerError(parsed.error), 400, slug);
  }
  const input = parsed.data;

  const admin = createAdminClient();
  const sesion = await getSesionById(g.ctx.tenantId, input.sesion_id, admin);
  if (!sesion) {
    g.log(404);
    return apiError("SESION_NO_ENCONTRADA", "Sesión no encontrada.", 404, slug);
  }
  if (sesion.estado === "cancelada") {
    g.log(409);
    return apiError("SESION_CANCELADA", "La sesión está cancelada.", 409, slug);
  }

  const { reserva, enListaEspera, error } = await reservarConCupo(
    g.ctx.tenantId,
    input.sesion_id,
    {
      miembroId: input.miembro_id ?? null,
      nombreVisitante: input.nombre,
      telefonoVisitante: input.telefono,
      origen: "api",
    },
    admin
  );
  if (!reserva) {
    g.log(409);
    return apiError(
      "VALIDATION_ERROR",
      error ?? "No se pudo crear la reserva.",
      409,
      slug
    );
  }

  // Clase gratis + sin miembro → prospecto automático en el CRM.
  if (sesion.clase?.tipo === "gratis" && !input.miembro_id) {
    await crearProspectoDesdeClaseGratis(
      g.ctx.tenantId,
      { tipo: "gratis", nombre: sesion.clase.nombre },
      { id: reserva.id },
      { nombre: input.nombre, telefono: input.telefono },
      sesion.fecha,
      admin
    );
  }

  g.log(201);
  return apiSuccess(
    {
      reserva_id: reserva.id,
      estado: reserva.estado,
      mensaje: enListaEspera
        ? "Estás en lista de espera. Te avisaremos si se libera un lugar."
        : "Tu lugar está confirmado.",
    },
    { slug, status: 201 }
  );
}
