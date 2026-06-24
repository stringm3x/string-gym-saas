import { notFound } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import { getSesionById } from "@/lib/queries/clases.queries";
import { SesionDetalle } from "@/components/clases/SesionDetalle";

export default async function SesionDetallePage({
  params,
}: {
  params: Promise<{ slug: string; sesionId: string }>;
}) {
  const { sesionId } = await params;
  const tenant = await getTenant();

  if (
    !hasFeature(tenant.plan, "clases") ||
    !hasPermission(tenant.role, "ver_clases")
  ) {
    notFound();
  }

  const sesion = await getSesionById(tenant.id, sesionId);
  if (!sesion) notFound();

  return (
    <SesionDetalle
      sesion={sesion}
      slug={tenant.slug}
      canGestionar={hasPermission(tenant.role, "gestionar_clases")}
    />
  );
}
