import { LuSnowflake, LuArrowLeftRight } from "react-icons/lu";
import { formatFecha } from "@/lib/utils/format";
import type { EventoMiembro } from "@/lib/queries/miembro-eventos.queries";

/** Historial de membresía (planes sin timeline unificado): tarjeta con
 * cabecera, fecha en mono, ícono sin círculo de color. */
export function EventosTimeline({ eventos }: { eventos: EventoMiembro[] }) {
  if (eventos.length === 0) return null;

  return (
    <section className="card-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-text-primary">
          Historial de membresía
        </h3>
        <span className="font-mono text-etiqueta text-text-muted">
          {eventos.length}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {eventos.map((e) => (
          <li key={e.id} className="flex items-start gap-4 px-5 py-4">
            <span
              className="mt-0.5 shrink-0 text-text-muted"
              aria-hidden="true"
            >
              {e.tipo === "congelacion" ? (
                <LuSnowflake className="h-4 w-4" />
              ) : (
                <LuArrowLeftRight className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-5 text-text-primary">
                {e.descripcion}
              </p>
              {e.tipo === "congelacion" && e.fecha_inicio && e.fecha_fin && (
                <p className="mt-0.5 font-mono text-dato text-text-secondary">
                  {formatFecha(e.fecha_inicio)} — {formatFecha(e.fecha_fin)}
                </p>
              )}
              <p className="mt-0.5 text-sm text-text-muted">
                <span className="font-mono">{formatFecha(e.created_at)}</span>
                {e.creado_por_nombre && ` · ${e.creado_por_nombre}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
