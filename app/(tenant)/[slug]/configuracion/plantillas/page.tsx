import { getTenant } from "@/lib/tenant";
import { listPlantillas } from "@/lib/queries/plantillas.queries";
import { ConfigTabs } from "@/components/configuracion/ConfigTabs";
import { PlantillasManager } from "@/components/configuracion/PlantillasManager";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PlantillasPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();

  const plantillas = await listPlantillas(tenant.id, { soloActivas: false });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          Configuración
        </h2>
      </div>

      <ConfigTabs slug={slug} />

      <PlantillasManager plantillas={plantillas} />
    </div>
  );
}
