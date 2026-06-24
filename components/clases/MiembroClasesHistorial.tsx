import { formatHora12, formatDiaCorto, hoyYMD } from "@/lib/utils/clases-format";
import type { ReservaMiembro } from "@/lib/types/clases";

const ESTADO_LABEL: Record<string, { label: string; cls: string }> = {
  confirmada: { label: "Confirmada", cls: "text-brand-green" },
  en_lista_espera: { label: "Lista de espera", cls: "text-warning" },
  asistio: { label: "Asistió", cls: "text-brand-green" },
  no_asistio: { label: "No asistió", cls: "text-text-muted" },
  cancelada: { label: "Cancelada", cls: "text-text-muted" },
};

function Fila({ r }: { r: ReservaMiembro }) {
  const estado = ESTADO_LABEL[r.estado] ?? ESTADO_LABEL.cancelada;
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: r.sesion?.clase?.color ?? "#10b981" }}
        />
        <div>
          <p className="text-xs font-medium text-text-primary">
            {r.sesion?.clase?.nombre ?? "Clase"}
          </p>
          <p className="text-[10px] text-text-muted">
            {r.sesion ? formatDiaCorto(r.sesion.fecha) : "—"}
            {r.sesion && ` · ${formatHora12(r.sesion.hora_inicio)}`}
          </p>
        </div>
      </div>
      <span className={`text-[10px] font-medium ${estado.cls}`}>
        {estado.label}
      </span>
    </li>
  );
}

export function MiembroClasesHistorial({
  reservas,
}: {
  reservas: ReservaMiembro[];
}) {
  const hoy = hoyYMD();
  const relevantes = reservas.filter((r) => r.estado !== "cancelada");
  const asistio = reservas.filter((r) => r.estado === "asistio").length;
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Clases</h3>
        {tasa !== null && (
          <span className="text-xs text-text-secondary">
            Asistencia: <span className="text-text-primary">{tasa}%</span> (
            {asistio}/{relevantes.length})
          </span>
        )}
      </div>

      {reservas.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-xs text-text-secondary">
          Sin reservas de clases.
        </p>
      ) : (
        <div className="space-y-3">
          {proximas.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-wide text-text-muted">
                Próximas
              </p>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {proximas.map((r) => (
                  <Fila key={r.id} r={r} />
                ))}
              </ul>
            </div>
          )}
          {historico.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-wide text-text-muted">
                Histórico
              </p>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {historico.map((r) => (
                  <Fila key={r.id} r={r} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
