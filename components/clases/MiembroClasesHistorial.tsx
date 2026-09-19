import { formatHora12, formatDiaCorto, hoyYMD } from "@/lib/utils/clases-format";
import type { ReservaMiembro } from "@/lib/types/clases";

const ESTADO_LABEL: Record<string, { label: string; cls: string }> = {
  confirmada: { label: "Confirmada", cls: "text-text-secondary" },
  en_lista_espera: { label: "Lista de espera", cls: "text-warning" },
  asistio: { label: "Asistió", cls: "text-brand-green" },
  no_asistio: { label: "No asistió", cls: "text-danger" },
  cancelada: { label: "Cancelada", cls: "text-text-muted" },
};

function Fila({ r }: { r: ReservaMiembro }) {
  const estado = ESTADO_LABEL[r.estado] ?? ESTADO_LABEL.cancelada;
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: r.sesion?.clase?.color ?? "#10b981" }}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-5 text-text-primary">
            {r.sesion?.clase?.nombre ?? "Clase"}
          </p>
          <p className="font-mono text-dato text-text-muted">
            {r.sesion ? formatDiaCorto(r.sesion.fecha) : "—"}
            {r.sesion && ` · ${formatHora12(r.sesion.hora_inicio)}`}
          </p>
        </div>
      </div>
      <span
        className={`shrink-0 font-mono text-xs uppercase tracking-[0.12em] ${estado.cls}`}
      >
        {estado.label}
      </span>
    </li>
  );
}

/** Clases del miembro: tarjeta con cabecera y asistencia en mono; próximas
 * e histórico como dos listas con kicker. */
export function MiembroClasesHistorial({
  reservas,
}: {
  reservas: ReservaMiembro[];
}) {
  const hoy = hoyYMD();
  const relevantes = reservas.filter((r) => r.estado !== "cancelada");
  const asistio = reservas.filter((r) => r.estado === "asistio").length;
  const noShows = reservas.filter((r) => r.estado === "no_asistio").length;
  // Base de no-show: reservas ya resueltas (asistió o no asistió).
  const resueltas = asistio + noShows;
  const tasa =
    relevantes.length > 0
      ? Math.round((asistio / relevantes.length) * 100)
      : null;

  const proximas = reservas.filter(
    (r) =>
      r.sesion &&
      r.sesion.fecha >= hoy &&
      (r.estado === "confirmada" || r.estado === "en_lista_espera")
  );
  const historico = reservas.filter(
    (r) => !proximas.includes(r) && r.estado !== "cancelada"
  );

  return (
    <section className="card-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-text-primary">Clases</h3>
        <div className="flex items-center gap-4 font-mono text-dato tabular-nums text-text-secondary">
          {tasa !== null && (
            <span>
              Asistencia{" "}
              <span className="text-text-primary">{tasa}%</span> ({asistio}/
              {relevantes.length})
            </span>
          )}
          {noShows > 0 && (
            <span className="text-warning">
              Inasistencias {noShows}
              {resueltas > 0 &&
                ` (${Math.round((noShows / resueltas) * 100)}%)`}
            </span>
          )}
        </div>
      </div>

      {reservas.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-text-muted">
          Sin reservas de clases.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {proximas.length > 0 && (
            <div>
              <p className="border-b border-border px-5 py-3 font-mono text-etiqueta uppercase text-text-muted">
                Próximas
              </p>
              <ul className="divide-y divide-border">
                {proximas.map((r) => (
                  <Fila key={r.id} r={r} />
                ))}
              </ul>
            </div>
          )}
          {historico.length > 0 && (
            <div>
              <p className="border-b border-border px-5 py-3 font-mono text-etiqueta uppercase text-text-muted">
                Histórico
              </p>
              <ul className="divide-y divide-border">
                {historico.map((r) => (
                  <Fila key={r.id} r={r} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
