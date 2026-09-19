"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LuChevronLeft, LuChevronRight, LuCalendarDays } from "react-icons/lu";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  diasDeSemana,
  sumarDiasYMD,
  formatDiaCorto,
  formatHora12,
  hoyYMD,
} from "@/lib/utils/clases-format";
import { cn } from "@/lib/utils/cn";
import type { ClaseSesion } from "@/lib/types/clases";

const BTN =
  "inline-flex h-11 items-center gap-1 border border-border px-3 text-sm text-text-primary transition-colors hover:border-text-secondary";

/**
 * Calendario semanal: controles de 44px, día de hoy con el estado
 * seleccionado (fondo lleno + ácido), hora y cupo en mono.
 */
export function CalendarioSemanal({
  sesiones,
  lunes,
  slug,
}: {
  sesiones: ClaseSesion[];
  lunes: string;
  slug: string;
}) {
  const router = useRouter();
  const [instructor, setInstructor] = useState("");

  const dias = diasDeSemana(lunes);
  const hoy = hoyYMD();

  const instructores = useMemo(() => {
    const set = new Set<string>();
    for (const s of sesiones) {
      if (s.clase?.instructor) set.add(s.clase.instructor);
    }
    return [...set].sort();
  }, [sesiones]);

  const visibles = instructor
    ? sesiones.filter((s) => s.clase?.instructor === instructor)
    : sesiones;

  function irA(semana: string) {
    router.push(`/${slug}/clases?semana=${semana}`);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => irA(sumarDiasYMD(lunes, -7))}
            className={BTN}
          >
            <LuChevronLeft className="h-4 w-4" aria-hidden="true" /> Anterior
          </button>
          <button type="button" onClick={() => irA(hoy)} className={BTN}>
            Hoy
          </button>
          <button
            type="button"
            onClick={() => irA(sumarDiasYMD(lunes, 7))}
            className={BTN}
          >
            Siguiente <LuChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {instructores.length > 0 && (
          <select
            value={instructor}
            onChange={(e) => setInstructor(e.target.value)}
            aria-label="Filtrar por instructor"
            className="h-11 rounded border border-border bg-bg px-3 text-sm text-text-primary focus:border-brand-green focus:outline-none"
          >
            <option value="">Todos los instructores</option>
            {instructores.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Grid semanal */}
      <div className="overflow-x-auto">
        <div className="grid min-w-[840px] grid-cols-7 gap-2">
          {dias.map((dia) => {
            const delDia = visibles
              .filter((s) => s.fecha === dia)
              .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
            const esHoy = dia === hoy;
            return (
              <div key={dia} className="min-h-[120px]">
                <div
                  className={cn(
                    "mb-2 border px-2 py-2 text-center font-mono text-etiqueta uppercase",
                    esHoy
                      ? "border-brand-green bg-surface-hover text-brand-green"
                      : "border-transparent text-text-muted"
                  )}
                >
                  {formatDiaCorto(dia)}
                </div>
                <div className="flex flex-col gap-2">
                  {delDia.map((s) => {
                    const confirmadas = s.cupo_maximo - s.cupo_disponible;
                    const lleno = s.cupo_disponible <= 0;
                    const cancelada = s.estado === "cancelada";
                    return (
                      <Link
                        key={s.id}
                        href={`/${slug}/clases/${s.id}`}
                        className={cn(
                          "flex min-h-11 overflow-hidden border border-border bg-surface transition-colors hover:border-text-secondary",
                          cancelada && "opacity-50"
                        )}
                      >
                        <span
                          className="w-1 shrink-0"
                          style={{ backgroundColor: s.clase?.color ?? "#10b981" }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 px-2 py-2">
                          <span className="block truncate text-sm text-text-primary">
                            {s.clase?.nombre ?? "Clase"}
                          </span>
                          <span className="block font-mono text-xs text-text-muted">
                            {formatHora12(s.hora_inicio)}
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 block font-mono text-xs tabular-nums",
                              cancelada
                                ? "text-danger"
                                : lleno
                                  ? "text-warning"
                                  : "text-text-secondary"
                            )}
                          >
                            {cancelada
                              ? "Cancelada"
                              : `${confirmadas}/${s.cupo_maximo}${lleno ? " · Llena" : ""}`}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {sesiones.length === 0 && (
        <EmptyState
          icon={<LuCalendarDays />}
          title="Sin sesiones esta semana"
          description="Cambia de semana con las flechas, o crea clases con horario y cupo para que se generen sus sesiones."
          action={
            <Link
              href={`/${slug}/configuracion/clases`}
              className="inline-flex h-11 items-center gap-2 border border-border px-4 text-sm text-text-primary transition-colors hover:border-text-secondary"
            >
              Configurar clases
            </Link>
          }
        />
      )}
    </div>
  );
}
