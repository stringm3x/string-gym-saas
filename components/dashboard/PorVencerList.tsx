import Link from "next/link";
import { LuClock, LuChevronRight } from "react-icons/lu";
import { formatFecha } from "@/lib/utils/format";
import { diasParaVencer } from "@/lib/utils/estado-membresia";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { MiembroPorVencer } from "@/lib/queries/dashboard.queries";

interface PorVencerListProps {
  miembros: MiembroPorVencer[];
  slug: string;
}

export function PorVencerList({ miembros, slug }: PorVencerListProps) {
  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <LuClock className="h-4 w-4 text-warning" />
          <h3 className="text-sm font-semibold text-text-primary">
            Por vencer (7 días)
          </h3>
        </div>
        {miembros.length > 0 && (
          <Link
            href={`/${slug}/miembros?filter=por_vencer`}
            className="text-xs text-text-secondary transition-colors hover:text-brand-green"
          >
            Ver todos
          </Link>
        )}
      </div>

      {miembros.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={<LuClock className="h-5 w-5" />}
            title="Todo en orden"
            description="Ningún miembro vence en los próximos 7 días."
            className="border-0"
          />
        </div>
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
                  className="flex items-center justify-between gap-3 px-5 py-3 transition-colors duration-150 hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {m.nombre}
                    </p>
                    <p className="truncate text-xs text-text-secondary">
                      Vence el {formatFecha(m.fecha_vencimiento)}
                      {m.telefono && (
                        <>
                          {" · "}
                          <span className="font-mono">{m.telefono}</span>
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
