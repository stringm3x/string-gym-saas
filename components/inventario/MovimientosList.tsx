import {
  LuArrowDownToLine,
  LuArrowUpFromLine,
  LuRefreshCw,
} from "react-icons/lu";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatFechaHora } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { MovimientoConProducto } from "@/lib/queries/productos.queries";

interface MovimientosListProps {
  movimientos: MovimientoConProducto[];
}

const tipoConfig = {
  entrada: {
    label: "Entrada",
    icon: LuArrowDownToLine,
    variant: "success" as const,
    sign: "+",
  },
  salida: {
    label: "Salida",
    icon: LuArrowUpFromLine,
    variant: "danger" as const,
    sign: "−",
  },
  ajuste: {
    label: "Ajuste",
    icon: LuRefreshCw,
    variant: "warning" as const,
    sign: "",
  },
};

export function MovimientosList({ movimientos }: MovimientosListProps) {
  if (movimientos.length === 0) {
    return (
      <EmptyState
        icon={<LuRefreshCw className="h-5 w-5" />}
        title="Sin movimientos"
        description="Cuando registres entradas, salidas o ajustes, aparecerán aquí con su motivo."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <ul className="divide-y divide-border">
        {movimientos.map((m) => {
          const cfg = tipoConfig[m.tipo];
          const Icon = cfg.icon;

          return (
            <li key={m.id} className="flex items-center gap-4 px-4 py-3">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  m.tipo === "entrada" && "bg-brand-green/15 text-brand-green",
                  m.tipo === "salida" && "bg-danger/15 text-danger",
                  m.tipo === "ajuste" && "bg-warning/15 text-warning"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {m.producto_nombre}
                  </p>
                  <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  {m.pago_id && <Badge variant="neutral">Venta</Badge>}
                </div>
                <p className="text-xs text-text-secondary">
                  {formatFechaHora(m.created_at)}
                  {m.motivo && (
                    <>
                      {" · "}
                      <span className="italic">{m.motivo}</span>
                    </>
                  )}
                </p>
              </div>

              <span
                className={cn(
                  "font-mono text-sm font-bold tabular-nums",
                  m.tipo === "entrada" && "text-brand-green",
                  m.tipo === "salida" && "text-danger",
                  m.tipo === "ajuste" && "text-warning"
                )}
              >
                {cfg.sign}
                {m.cantidad}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
