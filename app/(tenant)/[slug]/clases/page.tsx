import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import {
  getSesionesByRango,
  getNoShowStats,
} from "@/lib/queries/clases.queries";
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

  const [sesiones, noShowStats] = await Promise.all([
    getSesionesByRango(tenant.id, lunes, domingo),
    getNoShowStats(tenant.id, 30),
  ]);

  const conNoShow = noShowStats.filter((s) => s.noShows > 0);

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

      {conNoShow.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-text-primary">
            No-shows por clase
          </h2>
          <p className="mt-0.5 text-xs text-text-muted">
            Inasistencia de los últimos 30 días (asistió vs. no asistió).
          </p>
          <ul className="mt-3 space-y-2">
            {conNoShow.map((s) => (
              <li
                key={s.clase_id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="truncate text-text-primary">{s.nombre}</span>
                <span className="shrink-0 text-text-secondary">
                  <span
                    className={
                      s.tasa >= 30 ? "text-warning" : "text-text-primary"
                    }
                  >
                    {s.tasa}%
                  </span>{" "}
                  ({s.noShows}/{s.resueltas})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
