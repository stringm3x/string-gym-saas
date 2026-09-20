import { requirePanel } from "@/lib/authz/pagina";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { listPlantillas } from "@/lib/queries/plantillas.queries";
import { PlantillasManager } from "@/components/configuracion/PlantillasManager";
import { UpgradePage } from "@/components/ui/UpgradePage";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PlantillasPage({ params }: PageProps) {
  const { slug } = await params;
  // Misma política que createPlantillaAction: plantillas_mensaje (Pro) + configurar_planes_promociones.
  const g = await requirePanel("config.plantilla_crear", { sinPermiso: "/configuracion/gym" });

  if (!g.ok) {
    const gym = await getGymInfo(g.ctx.id);
    return (
      <UpgradePage
        titulo="Plantillas de mensaje"
        descripcion="Crea plantillas de WhatsApp con variables para agilizar tu seguimiento."
        beneficios={[
          "Plantillas reutilizables con {{nombre}} y {{fecha_vencimiento}}",
          "Inserción rápida desde las acciones de cada miembro",
          "Mensajes consistentes para todo tu equipo",
        ]}
        planRequerido={g.planRequerido}
        gymNombre={gym?.nombre ?? ""}
        slug={slug}
      />
    );
  }

  const plantillas = await listPlantillas(g.ctx.id, { soloActivas: false });

  return <PlantillasManager plantillas={plantillas} />;
}
