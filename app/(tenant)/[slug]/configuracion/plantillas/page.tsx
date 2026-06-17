import { getTenant } from "@/lib/tenant";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { listPlantillas } from "@/lib/queries/plantillas.queries";
import { hasFeature } from "@/lib/features";
import { PlantillasManager } from "@/components/configuracion/PlantillasManager";
import { UpgradePage } from "@/components/ui/UpgradePage";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PlantillasPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();

  if (!hasFeature(tenant.plan, "plantillas_mensaje")) {
    const gym = await getGymInfo(tenant.id);
    return (
      <UpgradePage
        titulo="Plantillas de mensaje"
        descripcion="Crea plantillas de WhatsApp con variables para agilizar tu seguimiento."
        beneficios={[
          "Plantillas reutilizables con {{nombre}} y {{fecha_vencimiento}}",
          "Inserción rápida desde las acciones de cada miembro",
          "Mensajes consistentes para todo tu equipo",
        ]}
        planRequerido="pro"
        gymNombre={gym?.nombre ?? ""}
        slug={slug}
      />
    );
  }

  const plantillas = await listPlantillas(tenant.id, { soloActivas: false });

  return <PlantillasManager plantillas={plantillas} />;
}
