"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { LuPhone, LuCalendar, LuGripVertical, LuUserPlus } from "react-icons/lu";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TagBadges } from "@/components/ui/TagSelector";
import type { ProspectoConTags } from "@/lib/queries/prospectos.queries";

const origenLabels: Record<ProspectoConTags["origen"], string> = {
  landing: "Landing",
  whatsapp: "WhatsApp",
  referido: "Referido",
  manual: "Manual",
  clase_gratis: "Clase gratis",
  api: "API",
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
  onInscribir?: (prospecto: ProspectoConTags) => void;
}

export function ProspectoCard({
  prospecto,
  onClick,
  onInscribir,
}: ProspectoCardProps) {
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
        "relative border border-border bg-surface p-4 transition-colors duration-150 hover:border-text-secondary",
        isDragging ? "opacity-50" : ""
      )}
    >
      {/* Asa de arrastre: siempre visible (en tablet no hay hover). */}
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label="Arrastrar"
        className="absolute right-1 top-1 flex h-9 w-9 cursor-grab touch-none items-center justify-center text-text-muted transition-colors hover:text-text-primary active:cursor-grabbing"
      >
        <LuGripVertical size={14} />
      </button>

      {/* Clickable body */}
      <button
        type="button"
        onClick={() => onClick(prospecto)}
        className="w-full text-left"
      >
        <div className="mb-2 pr-8">
          <p className="text-sm font-medium leading-snug text-text-primary">
            {prospecto.nombre}
          </p>
          <p className="mt-1 flex items-center gap-1 font-mono text-xs tabular-nums text-text-muted">
            <LuPhone className="h-3 w-3" aria-hidden="true" />
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

        <p className="mt-2 font-mono text-xs uppercase text-text-muted">
          {formatRelativeDate(prospecto.created_at)}
        </p>
      </button>

      {prospecto.estado === "convertido" && onInscribir && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leftIcon={<LuUserPlus className="h-3.5 w-3.5" />}
          onClick={() => onInscribir(prospecto)}
          className="mt-3 w-full text-brand-green hover:border-brand-green"
        >
          Inscribir como miembro
        </Button>
      )}
    </div>
  );
}
