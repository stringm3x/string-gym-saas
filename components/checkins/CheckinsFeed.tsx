import Link from "next/link";
import { LuUser } from "react-icons/lu";
import { formatFechaHora } from "@/lib/utils/format";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CheckinConMiembro } from "@/lib/queries/checkins.queries";

interface CheckinsFeedProps {
  checkins: CheckinConMiembro[];
  slug: string;
}

export function CheckinsFeed({ checkins, slug }: CheckinsFeedProps) {
  if (checkins.length === 0) {
    return (
      <EmptyState
        icon={<LuUser className="h-5 w-5" />}
        title="Sin check-ins hoy"
        description="Cuando registres el primer check-in del día, aparecerá aquí."
      />
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {checkins.map((c) => (
        <li key={c.id}>
          <Link
            href={`/${slug}/miembros/${c.miembro_id}`}
            className="flex items-center justify-between gap-4 px-4 py-3 transition-colors duration-150 hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-text-muted">
                <LuUser className="h-3.5 w-3.5" />
              </div>
              <p className="truncate text-sm font-medium text-text-primary">
                {c.miembro_nombre}
              </p>
            </div>

            <span className="shrink-0 font-mono text-xs text-text-secondary">
              {formatFechaHora(c.fecha_hora)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
