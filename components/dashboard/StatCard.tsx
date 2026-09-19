"use client";

import { useCountUp } from "@/lib/hooks/useCountUp";
import { cn } from "@/lib/utils/cn";
import { Sparkline } from "@/components/dashboard/Sparkline";

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
  /** Serie corta para el sparkline (solo cards con histórico). */
  sparkline?: number[];
  /** Color del sparkline (por defecto el acento del gym). */
  sparklineColor?: string;
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

/**
 * Tarjeta de dato del panel (artboard "Panel del día"): etiqueta en mono,
 * cifra grande en Ubuntu Mono (alinea los dígitos), una línea de contexto.
 * Sin ícono en caja de color ni glow: solo borde y ritmo.
 */
export function StatCard({
  label,
  value,
  format = "integer",
  icon,
  variant = "default",
  delta,
  hint,
  index = 0,
  sparkline,
  sparklineColor = "var(--color-brand-green)",
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
      className="card-surface animate-stat-in flex flex-col gap-2.5 p-5"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-etiqueta uppercase text-text-secondary">
          {label}
        </p>
        {icon && (
          <span className="shrink-0 text-text-muted" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>

      <p
        className={cn(
          "font-mono text-cifra font-bold tabular-nums",
          valueColors[variant]
        )}
      >
        {display}
      </p>

      {(delta || hint) && (
        <div className="flex items-center gap-2 text-sm">
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-mono font-bold tabular-nums",
                deltaColors[delta.direction]
              )}
            >
              <span aria-hidden="true">{deltaArrows[delta.direction]}</span>
              {Math.abs(delta.value).toFixed(0)}%
            </span>
          )}
          {hint && <span className="text-text-muted">{hint}</span>}
        </div>
      )}

      {sparkline && (
        <div className="mt-1">
          <Sparkline data={sparkline} color={sparklineColor} />
        </div>
      )}
    </div>
  );
}
