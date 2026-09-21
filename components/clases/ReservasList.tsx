"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuCheck, LuX, LuUserX, LuUndo2 } from "react-icons/lu";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  checkInReservaAction,
  cancelarReservaAction,
  marcarNoShowAction,
  deshacerAsistenciaAction,
  type SesionActionResult,
} from "@/app/(tenant)/[slug]/clases/[sesionId]/actions";
import type { ClaseReserva } from "@/lib/types/clases";

export function nombreDeReserva(r: ClaseReserva): string {
  return (
    r.miembro?.nombre ??
    r.prospecto?.nombre ??
    r.nombre_visitante ??
    "Visitante"
  );
}

const BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  confirmada: { label: "Confirmada", variant: "neutral" },
  asistio: { label: "Asistió", variant: "success" },
  no_asistio: { label: "No asistió", variant: "danger" },
};

const ICON_BTN =
  "flex h-11 w-11 items-center justify-center border border-border transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/** Reservas de la sesión: nombre, teléfono en mono, chip de estado y tres
 * botones de 44px (asistió / no llegó / cancelar). */
export function ReservasList({
  sesionId,
  reservas,
}: {
  sesionId: string;
  reservas: ClaseReserva[];
}) {
  const router = useRouter();
  const { error: toastError, warning } = useToast();
  const [pending, start] = useTransition();
  // A diferencia de "Asistió", marcar "No llegó" alimenta el bloqueo de
  // reservas por 30 días (clases_max_noshows) — un mis-tap tiene costo real.
  const [noShowAConfirmar, setNoShowAConfirmar] = useState<{
    sesionId: string;
    reservaId: string;
    nombre: string;
  } | null>(null);

  function run(fn: () => Promise<SesionActionResult>) {
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        toastError("No se pudo completar", r.error ?? "Inténtalo de nuevo.");
      } else if (r.advertencia) {
        warning("Listo, con un aviso", r.advertencia);
      }
      router.refresh();
    });
  }

  function confirmarNoShow() {
    if (!noShowAConfirmar) return;
    const { sesionId, reservaId } = noShowAConfirmar;
    run(() => marcarNoShowAction(sesionId, reservaId));
    setNoShowAConfirmar(null);
  }

  if (reservas.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-text-muted">
        Sin reservas todavía.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {reservas.map((r) => {
          const badge = BADGE[r.estado] ?? BADGE.no_asistio;
          const nombre = nombreDeReserva(r);
          return (
            <li
              key={r.id}
              className="flex items-center justify-between gap-4 px-5 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-[15px] leading-5 text-text-primary">
                  {nombre}
                </p>
                {r.miembro?.telefono && (
                  <p className="font-mono text-dato text-text-muted">
                    {r.miembro.telefono}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={badge.variant}>{badge.label}</Badge>
                {r.estado === "confirmada" && (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(() => checkInReservaAction(sesionId, r.id))
                      }
                      aria-label={`Marcar asistencia de ${nombre}`}
                      title="Asistió"
                      className={`${ICON_BTN} text-text-primary hover:border-brand-green hover:text-brand-green`}
                    >
                      <LuCheck className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        setNoShowAConfirmar({ sesionId, reservaId: r.id, nombre })
                      }
                      aria-label={`Marcar que ${nombre} no llegó`}
                      title="No llegó"
                      className={`${ICON_BTN} text-text-secondary hover:border-warning hover:text-warning`}
                    >
                      <LuUserX className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(() => cancelarReservaAction(sesionId, r.id))
                      }
                      aria-label={`Cancelar reserva de ${nombre}`}
                      title="Cancelar reserva"
                      className={`${ICON_BTN} text-text-secondary hover:border-danger hover:text-danger`}
                    >
                      <LuX className="h-4 w-4" />
                    </button>
                  </>
                )}
                {(r.estado === "asistio" || r.estado === "no_asistio") && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => deshacerAsistenciaAction(sesionId, r.id))
                    }
                    aria-label={`Deshacer estado de ${nombre}`}
                    title="Deshacer"
                    className={`${ICON_BTN} text-text-secondary hover:border-brand-green hover:text-brand-green`}
                  >
                    <LuUndo2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        open={noShowAConfirmar !== null}
        onClose={() => setNoShowAConfirmar(null)}
        title="Marcar que no llegó"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            ¿Marcar que {noShowAConfirmar?.nombre} no llegó? Esto cuenta para
            el límite de inasistencias de los últimos 30 días.
          </p>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setNoShowAConfirmar(null)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={confirmarNoShow}
              loading={pending}
            >
              No llegó
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
