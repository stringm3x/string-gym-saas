import Link from "next/link";
import { formatHora12 } from "@/lib/utils/clases-format";
import type { ClaseSesion } from "@/lib/types/clases";

/**
 * Clases de hoy (artboard "Panel del día"): hora en mono, nombre, cupo en
 * mono. Llena = cupo en ácido. Cancelada = atenuada.
 */
export function ClasesHoy({
  sesiones,
  slug,
}: {
  sesiones: ClaseSesion[];
  slug: string;
}) {
  if (sesiones.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-text-muted">
        No hay clases programadas para hoy.
      </p>
    );
  }

  const ordenadas = [...sesiones].sort((a, b) =>
    a.hora_inicio.localeCompare(b.hora_inicio)
  );

  return (
    <ul className="divide-y divide-border">
      {ordenadas.map((s) => {
        const confirmadas = s.cupo_maximo - s.cupo_disponible;
        const cancelada = s.estado === "cancelada";
        const llena = !cancelada && s.cupo_disponible <= 0;
        return (
          <li key={s.id}>
            <Link
              href={`/${slug}/clases/${s.id}`}
              className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-hover ${
                cancelada ? "opacity-50" : ""
              }`}
            >
              <span className="w-[52px] shrink-0 font-mono text-dato text-text-secondary">
                {formatHora12(s.hora_inicio)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] leading-5 text-text-primary">
                  {s.clase?.nombre ?? "Clase"}
                </span>
                {s.clase?.instructor && (
                  <span className="block text-sm text-text-muted">
                    {s.clase.instructor}
                  </span>
                )}
              </span>
              <span
                className={`shrink-0 font-mono text-dato tabular-nums ${
                  cancelada
                    ? "text-danger"
                    : llena
                      ? "text-brand-green"
                      : "text-text-muted"
                }`}
              >
                {cancelada ? "Cancelada" : `${confirmadas}/${s.cupo_maximo}`}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
