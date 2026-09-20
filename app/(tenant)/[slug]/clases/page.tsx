import { requirePanel } from "@/lib/authz/pagina";
import { getGymInfo } from "@/lib/queries/gyms.queries";
import {
  getSesionesByRango,
  getNoShowStats,
} from "@/lib/queries/clases.queries";
import {
  inicioSemana,
  sumarDiasYMD,
  hoyYMD,
  formatDiaCorto,
} from "@/lib/utils/clases-format";
import { UpgradePage } from "@/components/ui/UpgradePage";
import { CalendarioSemanal } from "@/components/clases/CalendarioSemanal";

export default async function ClasesCalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const g = await requirePanel("clases.reservar", { sinPermiso: "/checkins" });
  const tenant = g.ctx;

  if (!g.ok) {
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
        planRequerido={g.planRequerido}
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
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-etiqueta uppercase text-text-muted">
          Semana del {formatDiaCorto(lunes)} al {formatDiaCorto(domingo)}
        </p>
        <h1 className="text-pagina font-semibold text-text-primary">Clases</h1>
      </div>

      <CalendarioSemanal sesiones={sesiones} lunes={lunes} slug={tenant.slug} />

      {conNoShow.length > 0 && (
        <section className="card-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Inasistencias por clase
              </h2>
              <p className="mt-0.5 text-sm text-text-muted">
                Últimos 30 días: reservas que no llegaron sobre las resueltas.
              </p>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {conNoShow.map((s) => (
              <li
                key={s.clase_id}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <span className="truncate text-[15px] leading-5 text-text-primary">
                  {s.nombre}
                </span>
                <span className="shrink-0 font-mono text-dato tabular-nums text-text-secondary">
                  <span className={s.tasa >= 30 ? "text-warning" : "text-text-primary"}>
                    {s.tasa}%
                  </span>{" "}
                  ({s.noShows}/{s.resueltas})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
