"use client";

import { useCountUp } from "@/lib/hooks/useCountUp";
import { cn } from "@/lib/utils/cn";

interface StatCardProps {
  label: string;
  value: number;
  /** Formato del número. Por defecto entero con separadores es-MX. */
  format?: "integer" | "currency";
  icon?: React.ReactNode;
  /** Color de acento — define el color del valor grande. */
  variant?: "default" | "success" | "warning" | "danger";
  /** Comparativo opcional (ej. vs mes anterior). */
  delta?: {
    value: number;
    direction: "up" | "down" | "flat";
  };
  hint?: string;
}

const valueColors = {
  default: "text-text-primary",
  success: "text-brand-green",
  warning: "text-warning",
  danger: "text-danger",
};

const deltaColors = {
  up: "text-brand-green",
  down: "text-danger",
  flat: "text-text-muted",
};

const deltaArrows = { up: "↑", down: "↓", flat: "·" };

export function StatCard({
  label,
  value,
  format = "integer",
  icon,
  variant = "default",
  delta,
  hint,
}: StatCardProps) {
  const animated = useCountUp(value);

  let display: string;
  if (format === "currency") {
    display = "$" + Math.round(animated).toLocaleString("es-MX");
  } else {
    display = Math.round(animated).toLocaleString("es-MX");
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
          {label}
        </p>
        {icon && <div className="text-text-muted">{icon}</div>}
      </div>

      <p
        className={cn(
          "mt-2 font-mono text-3xl font-bold tabular-nums",
          valueColors[variant]
        )}
      >
        {display}
      </p>

      <div className="mt-1 flex items-center gap-2">
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
              deltaColors[delta.direction]
            )}
          >
            <span aria-hidden="true">{deltaArrows[delta.direction]}</span>
            {Math.abs(delta.value).toFixed(0)}%
          </span>
        )}
        {hint && <span className="text-xs text-text-secondary">{hint}</span>}
      </div>
    </div>
  );
}
