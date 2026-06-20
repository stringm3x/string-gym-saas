import { getTenant } from "@/lib/tenant";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { listProspectos } from "@/lib/queries/prospectos.queries";
import { listTags } from "@/lib/queries/tags.queries";
import { listPlantillas } from "@/lib/queries/plantillas.queries";
import { hasFeature } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { ProspectosKanban } from "@/components/prospectos/ProspectosKanban";
import { UpgradePage } from "@/components/ui/UpgradePage";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProspectosPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();

  if (!hasPermission(tenant.role, "ver_prospectos")) {
    redirect(`/${slug}/checkins`);
  }

  if (!hasFeature(tenant.plan, "prospectos")) {
    const gym = await getGymInfo(tenant.id);
    return (
      <UpgradePage
        titulo="Prospectos"
        descripcion="Lleva tu embudo de ventas con un tablero Kanban de prospectos."
        beneficios={[
          "Tablero por etapas (nuevo, contactado, convertido)",
          "Seguimiento con notas y acciones rápidas",
          "Conversión directa a miembro con cobro",
        ]}
        planRequerido="pro"
        gymNombre={gym?.nombre ?? ""}
        slug={slug}
      />
    );
  }

  const [prospectos, availableTags, plantillas] = await Promise.all([
    listProspectos(tenant.id),
    listTags(tenant.id),
    listPlantillas(tenant.id, { soloActivas: true }),
  ]);

  return (
    <div className="flex h-full flex-col space-y-4">
      <div>
        <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          Prospectos
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {prospectos.length === 0
            ? "Sin prospectos aún"
            : `${prospectos.length} prospecto${prospectos.length !== 1 ? "s" : ""} en total`}
        </p>
      </div>

      <ProspectosKanban prospectos={prospectos} slug={slug} availableTags={availableTags} plantillas={plantillas} />
    </div>
  );
}
