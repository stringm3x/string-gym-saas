"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuApple, LuPlus, LuChevronDown } from "react-icons/lu";
import { useToast } from "@/components/ui/Toast";
import type { PlanNutricion } from "@/lib/queries/nutricion.queries";
import { PlanNutricionForm } from "./PlanNutricionForm";
import { PlanNutricionCard } from "./PlanNutricionCard";
import { archivarPlanNutricionAction } from "@/app/(tenant)/[slug]/miembros/[id]/nutricion-actions";

type Modo = "ver" | "crear" | { editar: string };

interface Props {
  miembroId: string;
  planes: PlanNutricion[];
  disabled?: boolean;
}

export function MiembroNutricion({ miembroId, planes, disabled }: Props) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [modo, setModo] = useState<Modo>("ver");
  const [verHistorial, setVerHistorial] = useState(false);
  const [archivando, setArchivando] = useState<string | null>(null);
  const [, start] = useTransition();

  const activo = planes.find((p) => p.activo) ?? null;
  const historial = planes.filter((p) => !p.activo);
  const editandoId = typeof modo === "object" ? modo.editar : null;

  function cerrar() {
    setModo("ver");
    router.refresh();
  }

  function archivar(planId: string) {
    setArchivando(planId);
    start(async () => {
      const r = await archivarPlanNutricionAction(miembroId, planId);
      setArchivando(null);
      if (!r.ok) {
        toastError("No se pudo archivar", r.error ?? "Inténtalo de nuevo.");
        return;
      }
      success("Plan archivado");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <LuApple className="h-4 w-4 text-brand-green" />
          Nutrición
        </h3>
        {!disabled && modo === "ver" && (
          <button
            type="button"
            onClick={() => setModo("crear")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-bg transition-opacity hover:opacity-90"
          >
            <LuPlus className="h-3.5 w-3.5" />
            {activo ? "Nuevo plan" : "Crear plan"}
          </button>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {modo === "crear" && (
          <PlanNutricionForm
            miembroId={miembroId}
            onDone={cerrar}
            onCancel={() => setModo("ver")}
          />
        )}

        {activo && editandoId === activo.id ? (
          <PlanNutricionForm
            miembroId={miembroId}
            plan={activo}
            onDone={cerrar}
            onCancel={() => setModo("ver")}
          />
        ) : (
          activo && (
            <PlanNutricionCard
              plan={activo}
              onEditar={disabled ? undefined : () => setModo({ editar: activo.id })}
              onArchivar={disabled ? undefined : () => archivar(activo.id)}
              archivando={archivando === activo.id}
            />
          )
        )}

        {!activo && modo === "ver" && (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm text-text-secondary">
              Este miembro no tiene un plan de nutrición activo.
            </p>
            {!disabled && (
              <p className="mt-1 text-xs text-text-muted">
                Crea uno para asignarle comidas y objetivos.
              </p>
            )}
          </div>
        )}

        {historial.length > 0 && (
          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setVerHistorial((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              <LuChevronDown
                className={
                  "h-3.5 w-3.5 transition-transform " +
                  (verHistorial ? "rotate-180" : "")
                }
              />
              Historial ({historial.length})
            </button>
            {verHistorial && (
              <div className="mt-3 space-y-3">
                {historial.map((p) =>
                  editandoId === p.id ? (
                    <PlanNutricionForm
                      key={p.id}
                      miembroId={miembroId}
                      plan={p}
                      onDone={cerrar}
                      onCancel={() => setModo("ver")}
                    />
                  ) : (
                    <PlanNutricionCard
                      key={p.id}
                      plan={p}
                      onEditar={
                        disabled ? undefined : () => setModo({ editar: p.id })
                      }
                    />
                  )
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
