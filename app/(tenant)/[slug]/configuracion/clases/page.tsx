import { requirePanel } from "@/lib/authz/pagina";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { getClases } from "@/lib/queries/clases.queries";
import { getClasesMaxNoshows } from "@/lib/queries/gyms.queries";
import { UpgradePage } from "@/components/ui/UpgradePage";
import { ClasesList } from "@/components/clases/ClasesList";
import { NoShowPenaltyForm } from "@/components/clases/NoShowPenaltyForm";

export default async function ClasesConfigPage() {
  const g = await requirePanel("config.clase_crear", { sinPermiso: "/configuracion/gym" });
  const tenant = g.ctx;

  if (!g.ok) {
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
        planRequerido={g.planRequerido}
        gymNombre={gym?.nombre ?? ""}
        slug={tenant.slug}
      />
    );
  }

  const [clases, maxNoshows] = await Promise.all([
    getClases(tenant.id, true),
    getClasesMaxNoshows(tenant.id),
  ]);

  return (
    <div className="space-y-6">
      <ClasesList clases={clases} slug={tenant.slug} />
      <div className="border-t border-border pt-6">
        <NoShowPenaltyForm inicial={maxNoshows} />
      </div>
    </div>
  );
}
