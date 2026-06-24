"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import {
  diasDeSemana,
  sumarDiasYMD,
  formatDiaCorto,
  formatHora12,
  hoyYMD,
} from "@/lib/utils/clases-format";
import type { ClaseSesion } from "@/lib/types/clases";

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
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => irA(sumarDiasYMD(lunes, -7))}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            <LuChevronLeft className="h-3.5 w-3.5" /> Semana ant.
          </button>
          <button
            type="button"
            onClick={() => irA(hoy)}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => irA(sumarDiasYMD(lunes, 7))}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            Semana sig. <LuChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {instructores.length > 0 && (
          <select
            value={instructor}
            onChange={(e) => setInstructor(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:border-brand-green focus:outline-none"
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
                  className={`mb-2 rounded-lg px-2 py-1.5 text-center text-xs font-medium ${
                    esHoy
                      ? "bg-brand-green/10 text-brand-green"
                      : "text-text-secondary"
                  }`}
                >
                  {formatDiaCorto(dia)}
                </div>
                <div className="space-y-1.5">
                  {delDia.map((s) => {
                    const confirmadas = s.cupo_maximo - s.cupo_disponible;
                    const lleno = s.cupo_disponible <= 0;
                    const cancelada = s.estado === "cancelada";
                    return (
                      <Link
                        key={s.id}
                        href={`/${slug}/clases/${s.id}`}
                        className={`block overflow-hidden rounded-lg border border-border bg-surface hover:bg-bg ${
                          cancelada ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex">
                          <span
                            className="w-1 shrink-0"
                            style={{ backgroundColor: s.clase?.color ?? "#10b981" }}
                          />
                          <div className="min-w-0 flex-1 px-2 py-1.5">
                            <p className="truncate text-xs font-medium text-text-primary">
                              {s.clase?.nombre ?? "Clase"}
                            </p>
                            <p className="text-[10px] text-text-muted">
                              {formatHora12(s.hora_inicio)}
                            </p>
                            <p className="mt-0.5 text-[10px] text-text-secondary">
                              {confirmadas}/{s.cupo_maximo}
                              {cancelada ? (
                                <span className="ml-1 text-danger">cancelada</span>
                              ) : lleno ? (
                                <span className="ml-1 text-warning">Completo</span>
                              ) : null}
                            </p>
                          </div>
                        </div>
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
        <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center text-sm text-text-secondary">
          No hay sesiones esta semana. Crea clases en Configuración → Clases.
        </div>
      )}
    </div>
  );
}
