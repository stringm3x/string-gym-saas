import { formatFechaHora } from "@/lib/utils/format";
import type { Checkin } from "@/lib/queries/checkins.queries";

interface CheckinsHistoryProps {
  checkins: Checkin[];
}

/** Historial de check-ins de la ficha: una fecha por fila, en mono. Va
 * dentro de una tarjeta con cabecera (la pone la página). */
export function CheckinsHistory({ checkins }: CheckinsHistoryProps) {
  if (checkins.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-text-muted">
        Sin check-ins todavía.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {checkins.map((c) => (
        <li
          key={c.id}
          className="flex min-h-11 items-center px-5 py-3 font-mono text-dato tabular-nums text-text-secondary"
        >
          {formatFechaHora(c.fecha_hora)}
        </li>
      ))}
    </ul>
  );
}
