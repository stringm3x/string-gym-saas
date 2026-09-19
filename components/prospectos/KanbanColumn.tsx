"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils/cn";
import type { ProspectoEstado } from "@/lib/validations/prospecto.schema";

interface KanbanColumnProps {
  estado: ProspectoEstado;
  label: string;
  count: number;
  children: React.ReactNode;
  colorClass: string;
  isConverting?: boolean;
}

// Columna del tablero: encabezado en mono (etiqueta + conteo), cuerpo
// punteado sobre fondo; al soltar, borde ácido y fondo lleno.
export function KanbanColumn({
  estado,
  label,
  count,
  children,
  colorClass,
  isConverting = false,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: estado });

  return (
    <div className="flex min-w-[220px] flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <span className={cn("font-mono text-etiqueta uppercase", colorClass)}>
          {label}
        </span>
        <span className="font-mono text-etiqueta tabular-nums text-text-muted">
          {count}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 border border-dashed p-2 transition-colors duration-150",
          isOver && !isConverting
            ? "border-brand-green bg-surface-hover"
            : isOver && isConverting
              ? "border-warning bg-surface-hover"
              : "border-border bg-bg"
        )}
      >
        {children}
      </div>
    </div>
  );
}
