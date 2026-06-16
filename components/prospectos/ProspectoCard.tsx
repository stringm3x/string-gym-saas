"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { LuPhone, LuCalendar, LuGripVertical } from "react-icons/lu";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/Badge";
import { TagBadges } from "@/components/ui/TagSelector";
import type { ProspectoConTags } from "@/lib/queries/prospectos.queries";

const origenLabels: Record<ProspectoConTags["origen"], string> = {
  landing: "Landing",
  whatsapp: "WhatsApp",
  referido: "Referido",
  manual: "Manual",
};

function formatRelativeDate(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoy";
  if (days === 1) return "Hace 1 día";
  if (days < 7) return `Hace ${days} días`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "Hace 1 semana";
  return `Hace ${weeks} semanas`;
}

function isPruebaProxima(fecha: string | null): boolean {
  if (!fecha) return false;
  const ms = new Date(fecha).getTime() - Date.now();
  return ms > 0 && ms < 3 * 24 * 60 * 60 * 1000;
}

interface ProspectoCardProps {
  prospecto: ProspectoConTags;
  onClick: (prospecto: ProspectoConTags) => void;
}

export function ProspectoCard({ prospecto, onClick }: ProspectoCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: prospecto.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-lg border border-border bg-surface p-3 shadow-sm transition-shadow duration-150",
        isDragging ? "opacity-50 shadow-lg" : "hover:shadow-md"
      )}
    >
      {/* Drag handle */}
      <button
        {...listeners}
        {...attributes}
        aria-label="Arrastrar"
        className="absolute right-2 top-2 cursor-grab touch-none p-0.5 text-text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100 active:cursor-grabbing"
      >
        <LuGripVertical size={14} />
      </button>

      {/* Clickable body */}
      <button
        type="button"
        onClick={() => onClick(prospecto)}
        className="w-full text-left"
      >
        <div className="mb-2 pr-5">
          <p className="text-sm font-medium text-text-primary leading-snug">
            {prospecto.nombre}
          </p>
          <p className="mt-0.5 font-mono text-xs text-text-muted">
            <LuPhone className="mr-1 inline h-3 w-3" />
            {prospecto.telefono}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="neutral">{origenLabels[prospecto.origen as ProspectoConTags["origen"]]}</Badge>

          {isPruebaProxima(prospecto.fecha_prueba_agendada) && (
            <Badge variant="warning">
              <LuCalendar className="h-3 w-3" />
              Prueba pronto
            </Badge>
          )}
        </div>

        {prospecto.tags.length > 0 && (
          <div className="mt-1.5">
            <TagBadges tags={prospecto.tags} max={3} />
          </div>
        )}

        <p className="mt-2 text-xs text-text-muted">
          {formatRelativeDate(prospecto.created_at)}
        </p>
      </button>
    </div>
  );
}
