"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";

interface CheckinsChartProps {
  data: { fecha: string; cantidad: number }[];
}

const dayLabels = ["D", "L", "M", "M", "J", "V", "S"];

export function CheckinsChart({ data }: CheckinsChartProps) {
  const max = useMemo(() => {
    const m = Math.max(...data.map((d) => d.cantidad), 1);
    return m;
  }, [data]);

  const total = useMemo(() => data.reduce((s, d) => s + d.cantidad, 0), [data]);

  if (data.length === 0) {
    return (
      <div className="card-surface p-5">
        <p className="font-mono text-etiqueta uppercase text-text-secondary">
          Check-ins (últimos 7 días)
        </p>
        <p className="py-8 text-center text-sm text-text-muted">
          Todavía no hay check-ins registrados.
        </p>
      </div>
    );
  }

  const hoy = data[data.length - 1];

  return (
    <div className="card-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-etiqueta uppercase text-text-secondary">
            Check-ins (últimos 7 días)
          </p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-text-primary">
            {total}
          </p>
          <p className="text-xs text-text-muted">visitas en total</p>
        </div>

        <div className="text-right">
          <p className="font-mono text-lg font-bold tabular-nums text-brand-green">
            {hoy.cantidad}
          </p>
          <p className="text-xs text-text-muted">hoy</p>
        </div>
      </div>

      <div className="mt-5 flex h-24 items-end gap-1.5">
        {data.map((d, i) => {
          const date = new Date(d.fecha + "T00:00:00");
          const isHoy = i === data.length - 1;
          const heightPercent = (d.cantidad / max) * 100;

          return (
            <div
              key={d.fecha}
              className="flex h-full flex-1 flex-col items-center gap-1"
            >
              <div
                className="flex w-full flex-1 items-end"
                aria-label={`${d.cantidad} check-ins el ${d.fecha}`}
              >
                <div
                  className={cn(
                    "w-full transition-all duration-300",
                    isHoy ? "bg-brand-green" : "bg-text-muted/30",
                    d.cantidad === 0 && "bg-border"
                  )}
                  style={{
                    height: `${Math.max(
                      heightPercent,
                      d.cantidad > 0 ? 8 : 4
                    )}%`,
                  }}
                />
              </div>
              <span
                className={cn(
                  "font-mono text-xs uppercase tabular-nums",
                  isHoy ? "font-bold text-brand-green" : "text-text-muted"
                )}
              >
                {dayLabels[date.getDay()]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
