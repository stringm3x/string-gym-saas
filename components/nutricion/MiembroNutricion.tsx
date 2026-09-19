"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuPlus, LuChevronDown } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";
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
    <section className="card-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-text-primary">Nutrición</h3>
        {!disabled && modo === "ver" && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setModo("crear")}
            leftIcon={<LuPlus className="h-4 w-4" />}
          >
            {activo ? "Nuevo plan" : "Crear plan"}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 p-5">
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
          <p className="px-5 py-8 text-center text-sm text-text-muted">
            Sin plan de nutrición activo.
          </p>
        )}

        {historial.length > 0 && (
          <div className="border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setVerHistorial((v) => !v)}
              aria-expanded={verHistorial}
              className="inline-flex h-9 items-center gap-1.5 font-mono text-etiqueta uppercase text-text-muted transition-colors hover:text-text-primary"
            >
              <LuChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  verHistorial && "rotate-180"
                )}
                aria-hidden="true"
              />
              Historial · {historial.length}
            </button>
            {verHistorial && (
              <div className="mt-3 flex flex-col gap-3">
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
    </section>
  );
}
