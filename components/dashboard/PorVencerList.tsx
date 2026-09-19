import Link from "next/link";
import { LuClock, LuChevronRight } from "react-icons/lu";
import { formatFecha } from "@/lib/utils/format";
import { diasParaVencer } from "@/lib/utils/estado-membresia";
import { Badge } from "@/components/ui/Badge";
import type { MiembroPorVencer } from "@/lib/queries/dashboard.queries";

interface PorVencerListProps {
  miembros: MiembroPorVencer[];
  slug: string;
}

export function PorVencerList({ miembros, slug }: PorVencerListProps) {
  return (
    <div className="card-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <LuClock className="h-4 w-4 text-warning" aria-hidden="true" />
          <h3 className="text-base font-semibold text-text-primary">
            Por vencer (7 días)
          </h3>
        </div>
        {miembros.length > 0 && (
          <Link
            href={`/${slug}/miembros?filter=por_vencer`}
            className="text-sm text-text-secondary underline-offset-4 transition-colors hover:text-brand-green hover:underline"
          >
            Ver todos
          </Link>
        )}
      </div>

      {miembros.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-text-muted">
          Ningún miembro vence en los próximos 7 días.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {miembros.map((m) => {
            const dias = diasParaVencer(m.fecha_vencimiento) ?? 0;
            const variant = dias <= 1 ? "danger" : "warning";
            const label =
              dias === 0 ? "Hoy" : dias === 1 ? "Mañana" : `${dias} días`;

            return (
              <li key={m.id}>
                <Link
                  href={`/${slug}/miembros/${m.id}`}
                  className="flex min-h-[44px] items-center justify-between gap-3 px-5 py-3 transition-colors duration-150 hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {m.nombre}
                    </p>
                    <p className="truncate text-xs text-text-secondary">
                      Vence el{" "}
                      <span className="font-mono tabular-nums">
                        {formatFecha(m.fecha_vencimiento)}
                      </span>
                      {m.telefono && (
                        <>
                          {" · "}
                          <span className="font-mono tabular-nums">
                            {m.telefono}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={variant}>{label}</Badge>
                    <LuChevronRight className="h-3.5 w-3.5 text-text-muted" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
