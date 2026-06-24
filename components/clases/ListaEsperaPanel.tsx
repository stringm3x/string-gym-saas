"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuX } from "react-icons/lu";
import { cancelarReservaAction } from "@/app/(tenant)/[slug]/clases/[sesionId]/actions";
import { nombreDeReserva } from "./ReservasList";
import type { ClaseReserva } from "@/lib/types/clases";

export function ListaEsperaPanel({
  sesionId,
  reservas,
}: {
  sesionId: string;
  reservas: ClaseReserva[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (reservas.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-text-primary">
        Lista de espera ({reservas.length})
      </h3>
      <ul className="divide-y divide-border rounded-xl border border-warning/30 bg-warning/5">
        {reservas.map((r, i) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-2 px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-warning">#{i + 1}</span>
              <span className="text-sm text-text-primary">
                {nombreDeReserva(r)}
              </span>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await cancelarReservaAction(sesionId, r.id);
                  router.refresh();
                })
              }
              title="Quitar de lista de espera"
              className="rounded-lg border border-border p-1.5 text-text-secondary hover:text-danger disabled:opacity-50"
            >
              <LuX className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
