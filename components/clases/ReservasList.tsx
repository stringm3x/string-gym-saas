"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuCheck, LuX, LuUserX } from "react-icons/lu";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import {
  checkInReservaAction,
  cancelarReservaAction,
  marcarNoShowAction,
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
  const [pending, start] = useTransition();

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  if (reservas.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-text-muted">
        Sin reservas todavía.
      </p>
    );
  }

  return (
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
                      run(() => marcarNoShowAction(sesionId, r.id))
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
            </div>
          </li>
        );
      })}
    </ul>
  );
}
