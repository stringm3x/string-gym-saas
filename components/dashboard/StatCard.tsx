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
  /** Posición para el stagger de entrada. */
  index?: number;
}

const valueColors = {
  default: "text-text-primary",
  success: "text-brand-green",
  warning: "text-warning",
  danger: "text-danger",
};

const iconStyles = {
  default: "bg-surface-hover text-text-secondary",
  success: "bg-brand-green/10 text-brand-green",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
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
  index = 0,
}: StatCardProps) {
  const animated = useCountUp(value);

  let display: string;
  if (format === "currency") {
    display = "$" + Math.round(animated).toLocaleString("es-MX");
  } else {
    display = Math.round(animated).toLocaleString("es-MX");
  }

  return (
    <div
      className="animate-stat-in group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface to-surface/40 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-green/30 hover:shadow-lg hover:shadow-brand-green/5"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      {/* Glow sutil del color de marca en hover */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-brand-green/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
          {label}
        </p>
        {icon && (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              iconStyles[variant]
            )}
          >
            {icon}
          </span>
        )}
      </div>

      <p
        className={cn(
          "relative mt-3 font-mono text-3xl font-bold tabular-nums",
          valueColors[variant]
        )}
      >
        {display}
      </p>

      <div className="relative mt-1.5 flex items-center gap-2">
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md bg-bg/40 px-1.5 py-0.5 text-xs font-semibold tabular-nums",
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
