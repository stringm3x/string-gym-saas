import Link from "next/link";
import { formatHora12 } from "@/lib/utils/clases-format";
import type { ClaseSesion } from "@/lib/types/clases";

export function ClasesHoy({
  sesiones,
  slug,
}: {
  sesiones: ClaseSesion[];
  slug: string;
}) {
  if (sesiones.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-xs text-text-secondary">
        No hay clases programadas para hoy.
      </p>
    );
  }

  const ordenadas = [...sesiones].sort((a, b) =>
    a.hora_inicio.localeCompare(b.hora_inicio)
  );

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {ordenadas.map((s) => {
        const confirmadas = s.cupo_maximo - s.cupo_disponible;
        const cancelada = s.estado === "cancelada";
        return (
          <li key={s.id}>
            <Link
              href={`/${slug}/clases/${s.id}`}
              className={`flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-surface hover:bg-bg ${
                cancelada ? "opacity-50" : ""
              }`}
            >
              <span
                className="h-12 w-1.5"
                style={{ backgroundColor: s.clase?.color ?? "#10b981" }}
              />
              <div className="min-w-0 flex-1 py-2.5">
                <p className="truncate text-sm font-medium text-text-primary">
                  {s.clase?.nombre ?? "Clase"}
                </p>
                <p className="text-xs text-text-muted">
                  {formatHora12(s.hora_inicio)}
                  {s.clase?.instructor && ` · ${s.clase.instructor}`}
                </p>
              </div>
              <span className="pr-3 text-xs text-text-secondary">
                {cancelada ? (
                  <span className="text-danger">Cancelada</span>
                ) : (
                  `${confirmadas}/${s.cupo_maximo}`
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
