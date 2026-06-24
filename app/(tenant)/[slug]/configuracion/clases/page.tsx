import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { getClases } from "@/lib/queries/clases.queries";
import { UpgradePage } from "@/components/ui/UpgradePage";
import { ClasesList } from "@/components/clases/ClasesList";

export default async function ClasesConfigPage() {
  const tenant = await getTenant();

  // Owner ya garantizado por el layout de configuración (configurar_general).
  // Gate de feature: clases es Pro+.
  if (!hasFeature(tenant.plan, "clases")) {
    const gym = await getGymInfo(tenant.id);
    return (
      <UpgradePage
        titulo="Clases con cupo"
        descripcion="Programa clases recurrentes y únicas, controla cupo y lista de espera, y haz check-in de asistentes."
        beneficios={[
          "Clases recurrentes y talleres únicos",
          "Cupo máximo y lista de espera automática",
          "Clase gratis de prueba que genera prospectos",
          "Check-in de asistentes por sesión",
        ]}
        planRequerido="pro"
        gymNombre={gym?.nombre ?? ""}
        slug={tenant.slug}
      />
    );
  }

  const clases = await getClases(tenant.id, true);

  return (
    <div className="pt-2">
      <ClasesList clases={clases} slug={tenant.slug} />
    </div>
  );
}
