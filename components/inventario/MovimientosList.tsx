import {
  LuArrowDownToLine,
  LuArrowUpFromLine,
  LuArrowUpDown,
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
    color: "text-brand-green",
  },
  salida: {
    label: "Salida",
    icon: LuArrowUpFromLine,
    variant: "danger" as const,
    sign: "−",
    color: "text-danger",
  },
  ajuste: {
    label: "Ajuste",
    icon: LuRefreshCw,
    variant: "warning" as const,
    sign: "",
    color: "text-warning",
  },
};

export function MovimientosList({ movimientos }: MovimientosListProps) {
  if (movimientos.length === 0) {
    return (
      <EmptyState
        icon={<LuArrowUpDown />}
        title="Sin movimientos todavía"
        description="Cada entrada, salida o ajuste de stock queda registrado aquí con su fecha y motivo."
      />
    );
  }

  return (
    <div className="border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-text-primary">
          Movimientos
        </h3>
        <span className="font-mono text-etiqueta text-text-muted">
          {movimientos.length}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {movimientos.map((m) => {
          const cfg = tipoConfig[m.tipo];
          const Icon = cfg.icon;

          return (
            <li key={m.id} className="flex items-center gap-4 px-5 py-4">
              {/* Ícono a color, sin caja: el borde y el ritmo hacen el trabajo. */}
              <Icon
                className={cn("h-4 w-4 shrink-0", cfg.color)}
                aria-hidden="true"
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {m.producto_nombre}
                  </p>
                  <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  {m.pago_id && <Badge variant="neutral">Venta</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-text-secondary">
                  <span className="font-mono tabular-nums">
                    {formatFechaHora(m.created_at)}
                  </span>
                  {m.motivo && (
                    <>
                      {" · "}
                      <span className="text-text-muted">{m.motivo}</span>
                    </>
                  )}
                </p>
              </div>

              <span
                className={cn(
                  "font-mono text-dato font-bold tabular-nums",
                  cfg.color
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
