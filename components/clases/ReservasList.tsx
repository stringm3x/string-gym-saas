"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuCheck, LuX } from "react-icons/lu";
import {
  checkInReservaAction,
  cancelarReservaAction,
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

const BADGE: Record<string, { label: string; cls: string }> = {
  confirmada: {
    label: "Confirmada",
    cls: "border-brand-green/30 bg-brand-green/10 text-brand-green",
  },
  asistio: {
    label: "Asistió",
    cls: "border-brand-green/30 bg-brand-green/10 text-brand-green",
  },
  no_asistio: {
    label: "No asistió",
    cls: "border-border bg-bg text-text-muted",
  },
};

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
      <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-xs text-text-secondary">
        Sin reservas todavía.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {reservas.map((r) => {
        const badge = BADGE[r.estado] ?? BADGE.no_asistio;
        return (
          <li
            key={r.id}
            className="flex items-center justify-between gap-2 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-text-primary">
                {nombreDeReserva(r)}
              </p>
              {r.miembro?.telefono && (
                <p className="text-[11px] text-text-muted">
                  {r.miembro.telefono}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}
              >
                {badge.label}
              </span>
              {r.estado === "confirmada" && (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => checkInReservaAction(sesionId, r.id))
                    }
                    title="Marcar asistencia"
                    className="rounded-lg border border-brand-green/40 p-1.5 text-brand-green hover:bg-brand-green/10 disabled:opacity-50"
                  >
                    <LuCheck className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => cancelarReservaAction(sesionId, r.id))
                    }
                    title="Cancelar reserva"
                    className="rounded-lg border border-border p-1.5 text-text-secondary hover:text-danger disabled:opacity-50"
                  >
                    <LuX className="h-3.5 w-3.5" />
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
