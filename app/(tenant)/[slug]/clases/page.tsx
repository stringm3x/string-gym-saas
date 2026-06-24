import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import { getSesionesByRango } from "@/lib/queries/clases.queries";
import { inicioSemana, sumarDiasYMD, hoyYMD } from "@/lib/utils/clases-format";
import { UpgradePage } from "@/components/ui/UpgradePage";
import { CalendarioSemanal } from "@/components/clases/CalendarioSemanal";

export default async function ClasesCalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const tenant = await getTenant();

  if (!hasFeature(tenant.plan, "clases")) {
    const gym = await getGymInfo(tenant.id);
    return (
      <UpgradePage
        titulo="Clases con cupo"
        descripcion="Programa clases recurrentes y únicas, controla cupo y lista de espera, y haz check-in de asistentes."
        beneficios={[
          "Calendario semanal de clases",
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

  const { semana } = await searchParams;
  const lunes = inicioSemana(semana ?? hoyYMD());
  const domingo = sumarDiasYMD(lunes, 6);

  const sesiones = await getSesionesByRango(tenant.id, lunes, domingo);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          Clases
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Calendario semanal de sesiones.
        </p>
      </div>

      <CalendarioSemanal sesiones={sesiones} lunes={lunes} slug={tenant.slug} />
    </div>
  );
}
