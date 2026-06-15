import Link from "next/link";
import {
  LuPackage,
  LuCalendarX,
  LuCalendarClock,
  LuUserX,
  LuMessageSquareWarning,
} from "react-icons/lu";
import { cn } from "@/lib/utils/cn";
import type { Alerta, AlertaTipo } from "@/lib/queries/alertas.queries";

const iconByTipo: Record<AlertaTipo, React.ReactNode> = {
  stock_bajo: <LuPackage className="h-5 w-5" />,
  vencimiento_hoy: <LuCalendarX className="h-5 w-5" />,
  vencimiento_proximo: <LuCalendarClock className="h-5 w-5" />,
  prospecto_sin_contactar: <LuMessageSquareWarning className="h-5 w-5" />,
  miembro_inactivo: <LuUserX className="h-5 w-5" />,
};

const severidadStyles: Record<
  Alerta["severidad"],
  { border: string; icon: string }
> = {
  danger: {
    border: "border-danger/30 bg-danger/5",
    icon: "text-danger",
  },
  warning: {
    border: "border-warning/30 bg-warning/5",
    icon: "text-warning",
  },
  info: {
    border: "border-border bg-surface",
    icon: "text-brand-green",
  },
};

interface AlertaCardProps {
  alerta: Alerta;
}

export function AlertaCard({ alerta }: AlertaCardProps) {
  const styles = severidadStyles[alerta.severidad];

  return (
    <Link
      href={alerta.href}
      className={cn(
        "flex items-center gap-4 rounded-xl border p-4 transition-opacity hover:opacity-80",
        styles.border
      )}
    >
      <span className={cn("shrink-0", styles.icon)}>
        {iconByTipo[alerta.tipo]}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{alerta.titulo}</p>
        <p className="text-xs text-text-secondary mt-0.5">{alerta.descripcion}</p>
      </div>

      {alerta.count !== undefined && (
        <span
          className={cn(
            "shrink-0 font-mono text-2xl font-bold tabular-nums",
            styles.icon
          )}
        >
          {alerta.count}
        </span>
      )}
    </Link>
  );
}
