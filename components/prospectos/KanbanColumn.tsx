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
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={cn("text-xs font-semibold uppercase tracking-wide", colorClass)}>
          {label}
        </span>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-surface px-1.5 font-mono text-xs text-text-muted">
          {count}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 rounded-xl border-2 border-dashed p-2 transition-colors duration-150",
          isOver && !isConverting
            ? "border-brand-green/40 bg-brand-green/5"
            : isOver && isConverting
              ? "border-warning/40 bg-warning/5"
              : "border-border/50 bg-bg"
        )}
      >
        {children}
      </div>
    </div>
  );
}
