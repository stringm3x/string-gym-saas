"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuPencil, LuCalendarDays, LuCalendarPlus } from "react-icons/lu";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDiasSemana, formatHora12 } from "@/lib/utils/clases-format";
import { cn } from "@/lib/utils/cn";
import {
  toggleClaseActivaAction,
  generarSesionesAction,
} from "@/app/(tenant)/[slug]/configuracion/clases/actions";
import type { Clase } from "@/lib/types/clases";

const TIPO_LABEL: Record<Clase["tipo"], string> = {
  regular: "Regular",
  gratis: "Gratis",
  taller: "Taller",
  privada: "Privada",
};

/** Tarjeta de clase (configuración): barra de color, nombre, chip de tipo,
 * horario y cupo en mono, acciones pequeñas (h-9). */
export function ClaseCard({
  clase,
  slug,
  onEdit,
}: {
  clase: Clase;
  slug: string;
  onEdit: (c: Clase) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [genMsg, setGenMsg] = useState<string | null>(null);

  const horario = clase.es_recurrente
    ? `${formatDiasSemana(clase.dias_semana)} · ${formatHora12(clase.hora_inicio)}`
    : `${clase.fecha_inicio} · ${formatHora12(clase.hora_inicio)}`;

  function toggle() {
    start(async () => {
      await toggleClaseActivaAction(clase.id);
      router.refresh();
    });
  }

  function generar() {
    setGenMsg(null);
    start(async () => {
      const r = await generarSesionesAction(clase.id, 4);
      setGenMsg(
        r.ok
          ? r.sesionesGeneradas
            ? `${r.sesionesGeneradas} sesiones nuevas`
            : "Sin sesiones nuevas"
          : (r.error ?? "Error")
      );
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "card-surface flex overflow-hidden",
        !clase.activa && "opacity-60"
      )}
    >
      <div
        className="w-1.5 shrink-0"
        style={{ backgroundColor: clase.color }}
        aria-hidden="true"
      />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-text-primary">
                {clase.nombre}
              </h3>
              <Badge variant="neutral">{TIPO_LABEL[clase.tipo]}</Badge>
            </div>
            {clase.instructor && (
              <p className="mt-0.5 text-sm text-text-muted">{clase.instructor}</p>
            )}
          </div>
          <label className="flex min-h-9 shrink-0 cursor-pointer items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={clase.activa}
              disabled={pending}
              onChange={toggle}
              className="h-4 w-4 rounded accent-brand-green"
            />
            {clase.activa ? "Activa" : "Inactiva"}
          </label>
        </div>

        <p className="font-mono text-dato text-text-secondary">{horario}</p>
        <p className="text-sm text-text-muted">
          <span className="font-mono">{clase.cupo_maximo}</span> lugares
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onEdit(clase)}
            leftIcon={<LuPencil className="h-4 w-4" />}
          >
            Editar
          </Button>
          <Link
            href={`/${slug}/clases`}
            className="inline-flex h-9 items-center gap-2 border border-border px-3 text-sm text-text-primary transition-colors hover:border-text-secondary"
          >
            <LuCalendarDays className="h-4 w-4" aria-hidden="true" /> Ver
            sesiones
          </Link>
          {clase.es_recurrente && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={pending}
              onClick={generar}
              title="Generar sesiones de las próximas 4 semanas"
              leftIcon={<LuCalendarPlus className="h-4 w-4" />}
            >
              Generar sesiones
            </Button>
          )}
        </div>
        {genMsg && <p className="text-sm text-text-muted">{genMsg}</p>}
      </div>
    </div>
  );
}
