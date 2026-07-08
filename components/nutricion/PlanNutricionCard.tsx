"use client";

import { useState } from "react";
import { LuPencil, LuArchive, LuFlame, LuTarget } from "react-icons/lu";
import type { PlanNutricion } from "@/lib/queries/nutricion.queries";

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface Props {
  plan: PlanNutricion;
  onEditar?: () => void;
  onArchivar?: () => void;
  archivando?: boolean;
  /** Portal del miembro: oculta acciones (solo lectura). */
  readOnly?: boolean;
}

export function PlanNutricionCard({
  plan,
  onEditar,
  onArchivar,
  archivando,
  readOnly,
}: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const acciones = !readOnly && (!!onEditar || !!onArchivar);

  return (
    <div className="rounded-lg border border-border bg-bg p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-text-primary">
              {plan.titulo}
            </h4>
            {plan.activo && (
              <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-green">
                Activo
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
            {plan.objetivo && (
              <span className="inline-flex items-center gap-1">
                <LuTarget className="h-3.5 w-3.5" /> {plan.objetivo}
              </span>
            )}
            {plan.calorias_objetivo != null && (
              <span className="inline-flex items-center gap-1">
                <LuFlame className="h-3.5 w-3.5" /> {plan.calorias_objetivo} kcal
              </span>
            )}
            <span className="text-text-muted">Creado el {fecha(plan.created_at)}</span>
          </div>
        </div>

        {acciones && (
          <div className="flex shrink-0 items-center gap-1">
            {onEditar && (
              <button
                type="button"
                onClick={onEditar}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary"
              >
                <LuPencil className="h-3.5 w-3.5" /> Editar
              </button>
            )}
            {onArchivar &&
              (confirmando ? (
                <span className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onArchivar}
                    disabled={archivando}
                    className="rounded-lg bg-danger px-2.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {archivando ? "Archivando…" : "Confirmar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(false)}
                    className="rounded-lg px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary"
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmando(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:text-danger"
                >
                  <LuArchive className="h-3.5 w-3.5" /> Archivar
                </button>
              ))}
          </div>
        )}
      </div>

      {plan.comidas.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {plan.comidas.map((c, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
                {c.tiempo || "Comida"}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-text-secondary">
                {c.alimentos || "—"}
              </p>
            </div>
          ))}
        </div>
      )}

      {plan.notas && (
        <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs text-text-secondary">
          <span className="font-semibold text-text-primary">Notas: </span>
          <span className="whitespace-pre-line">{plan.notas}</span>
        </p>
      )}
    </div>
  );
}
