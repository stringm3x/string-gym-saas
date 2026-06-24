"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuPencil, LuCalendarDays } from "react-icons/lu";
import { formatDiasSemana, formatHora12 } from "@/lib/utils/clases-format";
import { toggleClaseActivaAction } from "@/app/(tenant)/[slug]/configuracion/clases/actions";
import type { Clase } from "@/lib/types/clases";

const TIPO_LABEL: Record<Clase["tipo"], string> = {
  regular: "Regular",
  gratis: "Gratis",
  taller: "Taller",
  privada: "Privada",
};

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

  const horario = clase.es_recurrente
    ? `${formatDiasSemana(clase.dias_semana)} · ${formatHora12(clase.hora_inicio)}`
    : `${clase.fecha_inicio} · ${formatHora12(clase.hora_inicio)}`;

  function toggle() {
    start(async () => {
      await toggleClaseActivaAction(clase.id);
      router.refresh();
    });
  }

  return (
    <div
      className={`flex overflow-hidden rounded-xl border border-border bg-surface ${
        clase.activa ? "" : "opacity-60"
      }`}
    >
      <div className="w-1.5 shrink-0" style={{ backgroundColor: clase.color }} />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary">
                {clase.nombre}
              </h3>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">
                {TIPO_LABEL[clase.tipo]}
              </span>
            </div>
            {clase.instructor && (
              <p className="text-xs text-text-muted">{clase.instructor}</p>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-text-secondary">
            <input
              type="checkbox"
              checked={clase.activa}
              disabled={pending}
              onChange={toggle}
              className="h-3.5 w-3.5 accent-brand-green"
            />
            {clase.activa ? "Activa" : "Inactiva"}
          </label>
        </div>

        <p className="text-xs text-text-secondary">{horario}</p>
        <p className="text-xs text-text-muted">{clase.cupo_maximo} lugares</p>

        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => onEdit(clase)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            <LuPencil className="h-3.5 w-3.5" /> Editar
          </button>
          <Link
            href={`/${slug}/clases`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            <LuCalendarDays className="h-3.5 w-3.5" /> Ver sesiones
          </Link>
        </div>
      </div>
    </div>
  );
}
