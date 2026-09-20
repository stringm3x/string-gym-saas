import { notFound } from "next/navigation";
import { requirePanel } from "@/lib/authz/pagina";
import { getSesionById } from "@/lib/queries/clases.queries";
import { SesionDetalle } from "@/components/clases/SesionDetalle";

export default async function SesionDetallePage({
  params,
}: {
  params: Promise<{ slug: string; sesionId: string }>;
}) {
  const { sesionId } = await params;
  // Misma política que createReservaAction (clases + ver_clases).
  const g = await requirePanel("clases.reservar", { sinPermiso: "/checkins" });
  if (!g.ok) notFound();
  const tenant = g.ctx;

  const sesion = await getSesionById(tenant.id, sesionId);
  if (!sesion) notFound();

  return (
    <SesionDetalle
      sesion={sesion}
      slug={tenant.slug}
      canGestionar={tenant.can("gestionar_clases")}
    />
  );
}
