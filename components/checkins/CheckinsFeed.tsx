import Link from "next/link";
import { TZ_MX } from "@/lib/utils/dates";
import type { CheckinConMiembro } from "@/lib/queries/checkins.queries";

interface CheckinsFeedProps {
  checkins: CheckinConMiembro[];
  slug: string;
}

function hora(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ_MX,
  }).format(new Date(iso));
}

/** Entradas del día: hora en mono a la izquierda, nombre, fila de 44px. */
export function CheckinsFeed({ checkins, slug }: CheckinsFeedProps) {
  if (checkins.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-text-muted">
        Todavía no hay entradas hoy.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {checkins.map((c) => (
        <li key={c.id}>
          <Link
            href={`/${slug}/miembros/${c.miembro_id}`}
            className="flex min-h-11 items-center gap-4 px-5 py-3 transition-colors duration-150 hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
          >
            <span className="w-[52px] shrink-0 font-mono text-dato tabular-nums text-text-secondary">
              {hora(c.fecha_hora)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px] leading-5 text-text-primary">
              {c.miembro_nombre}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
