"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuX } from "react-icons/lu";
import { cancelarReservaAction } from "@/app/(tenant)/[slug]/clases/[sesionId]/actions";
import { nombreDeReserva } from "./ReservasList";
import type { ClaseReserva } from "@/lib/types/clases";

/** Lista de espera: tarjeta con borde warning (sin fondo lleno), posición
 * en mono y botón de 44px para quitar. */
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
    <section className="border border-warning/40 bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-text-primary">
          Lista de espera
        </h3>
        <span className="font-mono text-etiqueta text-warning">
          {reservas.length}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {reservas.map((r, i) => {
          const nombre = nombreDeReserva(r);
          return (
            <li
              key={r.id}
              className="flex items-center justify-between gap-4 px-5 py-2"
            >
              <div className="flex min-w-0 items-center gap-4">
                <span className="w-8 shrink-0 font-mono text-dato tabular-nums text-warning">
                  #{i + 1}
                </span>
                <span className="truncate text-[15px] leading-5 text-text-primary">
                  {nombre}
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
                aria-label={`Quitar a ${nombre} de la lista de espera`}
                title="Quitar de lista de espera"
                className="flex h-11 w-11 shrink-0 items-center justify-center border border-border text-text-secondary transition-colors hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LuX className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
