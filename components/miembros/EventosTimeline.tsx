import { LuSnowflake, LuArrowLeftRight } from "react-icons/lu";
import { formatFecha } from "@/lib/utils/format";
import type { EventoMiembro } from "@/lib/queries/miembro-eventos.queries";

export function EventosTimeline({ eventos }: { eventos: EventoMiembro[] }) {
  if (eventos.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">
        Historial de membresía
      </h3>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {eventos.map((e) => (
          <li key={e.id} className="flex items-start gap-3 px-3 py-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg text-text-secondary">
              {e.tipo === "congelacion" ? (
                <LuSnowflake className="h-3.5 w-3.5" />
              ) : (
                <LuArrowLeftRight className="h-3.5 w-3.5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text-primary">{e.descripcion}</p>
              {e.tipo === "congelacion" && e.fecha_inicio && e.fecha_fin && (
                <p className="text-[11px] text-text-muted">
                  {formatFecha(e.fecha_inicio)} — {formatFecha(e.fecha_fin)}
                </p>
              )}
              <p className="text-[11px] text-text-muted">
                {formatFecha(e.created_at)}
                {e.creado_por_nombre && ` · ${e.creado_por_nombre}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
