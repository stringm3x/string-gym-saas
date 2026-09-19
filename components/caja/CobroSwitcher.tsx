"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { PagoForm } from "./PagoForm";
import { TicketCart } from "./TicketCart";
import type { PlanMembresia } from "@/lib/queries/planes.queries";
import type { Promocion } from "@/lib/queries/promociones.queries";
import type { ProductoConStock } from "@/lib/queries/productos.queries";

interface CobroSwitcherProps {
  slug: string;
  planes: PlanMembresia[];
  promocionesMembresia: Promocion[];
  promocionesProducto: Promocion[];
  productos: ProductoConStock[];
}

/**
 * Tarjeta "Registrar cobro" (artboard "Caja"). Alterna entre el cobro
 * rápido (una línea) y el ticket multi-línea (B4). Ambos comparten los
 * mismos datos; el modo es solo de UI.
 */
export function CobroSwitcher(props: CobroSwitcherProps) {
  const [modo, setModo] = useState<"rapido" | "ticket">("rapido");

  return (
    <section className="card-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-text-primary">
          Registrar cobro
        </h3>
        <div className="flex items-center gap-2">
          {(["rapido", "ticket"] as const).map((m) => {
            const activo = modo === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                aria-pressed={activo}
                className={cn(
                  "inline-flex h-9 items-center border px-3 text-sm transition-colors",
                  activo
                    ? "border-brand-green bg-surface-hover text-brand-green"
                    : "border-border text-text-secondary hover:border-text-secondary hover:text-text-primary"
                )}
              >
                {m === "rapido" ? "Cobro rápido" : "Ticket"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5">
        {modo === "rapido" ? (
          <PagoForm
            slug={props.slug}
            planes={props.planes}
            promocionesMembresia={props.promocionesMembresia}
            promocionesProducto={props.promocionesProducto}
            productos={props.productos}
          />
        ) : (
          <TicketCart
            slug={props.slug}
            productos={props.productos}
            planes={props.planes}
          />
        )}
      </div>
    </section>
  );
}
