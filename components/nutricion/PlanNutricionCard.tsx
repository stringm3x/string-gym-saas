"use client";

import { useState } from "react";
import { LuPencil, LuArchive } from "react-icons/lu";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { PlanNutricion } from "@/lib/queries/nutricion.queries";
import { TZ_MX } from "@/lib/utils/dates";

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    timeZone: TZ_MX,
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

/** Plan de nutrición: cabecera con chip "Activo", datos en mono
 * (kcal, fecha) y comidas como tarjetas con su tiempo en mono. */
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
    <div className="border border-border bg-bg">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-base font-semibold text-text-primary">
              {plan.titulo}
            </h4>
            {plan.activo && <Badge variant="success">Activo</Badge>}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
            {plan.objetivo && <span>{plan.objetivo}</span>}
            {plan.calorias_objetivo != null && (
              <span className="font-mono text-dato">
                {plan.calorias_objetivo} kcal
              </span>
            )}
            <span className="text-text-muted">
              Creado el {fecha(plan.created_at)}
            </span>
          </p>
        </div>

        {acciones && (
          <div className="flex shrink-0 items-center gap-2">
            {onEditar && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onEditar}
                leftIcon={<LuPencil className="h-4 w-4" />}
              >
                Editar
              </Button>
            )}
            {onArchivar &&
              (confirmando ? (
                <>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={onArchivar}
                    loading={archivando}
                  >
                    Confirmar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmando(false)}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmando(true)}
                  leftIcon={<LuArchive className="h-4 w-4" />}
                >
                  Archivar
                </Button>
              ))}
          </div>
        )}
      </div>

      {plan.comidas.length > 0 && (
        <div className="grid gap-3 border-t border-border px-5 py-4 sm:grid-cols-2">
          {plan.comidas.map((c, i) => (
            <div key={i} className="border border-border bg-surface p-4">
              <p className="font-mono text-etiqueta uppercase text-text-secondary">
                {c.tiempo || "Comida"}
              </p>
              <p className="mt-2 whitespace-pre-line text-sm text-text-primary">
                {c.alimentos || "—"}
              </p>
            </div>
          ))}
        </div>
      )}

      {plan.notas && (
        <div className="border-t border-border px-5 py-4">
          <p className="font-mono text-etiqueta uppercase text-text-muted">
            Notas
          </p>
          <p className="mt-2 whitespace-pre-line text-sm text-text-secondary">
            {plan.notas}
          </p>
        </div>
      )}
    </div>
  );
}
