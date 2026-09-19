import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type { Alerta } from "@/lib/queries/alertas.queries";

const countColor: Record<Alerta["severidad"], string> = {
  danger: "text-danger",
  warning: "text-warning",
  info: "text-text-primary",
};

const linkLabel: Record<Alerta["tipo"], string> = {
  stock_bajo: "Inventario",
  vencimiento_hoy: "Ver lista",
  vencimiento_proximo: "Ver lista",
  prospecto_sin_contactar: "Abrir",
  miembro_inactivo: "Ver lista",
};

interface AlertaCardProps {
  alerta: Alerta;
}

/**
 * Fila de "Puntos de atención" (artboard "Panel del día"): título, una
 * línea de contexto y el enlace a la derecha. Sin ícono ni fondo de color:
 * la severidad se lee en la cifra.
 */
export function AlertaCard({ alerta }: AlertaCardProps) {
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex min-w-0 items-center gap-4">
        {alerta.count !== undefined && (
          <span
            className={cn(
              "w-10 shrink-0 font-mono text-2xl font-bold tabular-nums",
              countColor[alerta.severidad]
            )}
          >
            {alerta.count}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[15px] leading-5 text-text-primary">
            {alerta.titulo}
          </p>
          <p className="mt-0.5 text-sm text-text-muted">{alerta.descripcion}</p>
        </div>
      </div>
      <Link
        href={alerta.href}
        className="shrink-0 text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
      >
        {linkLabel[alerta.tipo]}
      </Link>
    </li>
  );
}
