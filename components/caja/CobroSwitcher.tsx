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
 * Alterna entre el cobro rápido (una línea) y el ticket multi-línea (B4).
 * Ambos comparten los mismos datos; el modo es solo de UI.
 */
export function CobroSwitcher(props: CobroSwitcherProps) {
  const [modo, setModo] = useState<"rapido" | "ticket">("rapido");

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
        {(["rapido", "ticket"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModo(m)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              modo === m
                ? "bg-brand-green/15 text-brand-green"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {m === "rapido" ? "Cobro rápido" : "Ticket"}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-brand-green/20 bg-surface p-6">
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
    </div>
  );
}
