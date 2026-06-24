import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiGuard } from "@/lib/api/guard";
import { apiSuccess, apiError, corsPreflight } from "@/lib/api/response";
import { cancelarReserva } from "@/lib/queries/clases.queries";
import { promoverListaEspera } from "@/lib/utils/clases-cupo";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; reservaId: string }> }
) {
  const { slug, reservaId } = await params;
  const g = await apiGuard(request, slug, "/reservas/[id]", "DELETE");
  if (!g.ok) return g.response;

  const admin = createAdminClient();
  // cancelarReserva filtra por tenant_id → una key de otro gym no la encuentra.
  const { ok, sesionId } = await cancelarReserva(
    g.ctx.tenantId,
    reservaId,
    admin
  );
  if (!ok) {
    g.log(404);
    return apiError(
      "RESERVA_NO_ENCONTRADA",
      "Reserva no encontrada.",
      404,
      slug
    );
  }

  // Al liberar el lugar, promover al primero de la lista de espera.
  if (sesionId) {
    await promoverListaEspera(g.ctx.tenantId, sesionId, admin);
  }

  g.log(200);
  return apiSuccess(
    { cancelada: true, mensaje: "Reserva cancelada." },
    { slug }
  );
}
