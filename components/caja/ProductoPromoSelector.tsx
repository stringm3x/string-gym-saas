"use client";

import { LuTag } from "react-icons/lu";
import { cn } from "@/lib/utils/cn";
import { formatMoneda } from "@/lib/utils/format";
import type { Promocion } from "@/lib/queries/promociones.queries";

export type SeleccionProducto =
  | { kind: "promo"; promo: Promocion }
  | { kind: "custom" };

interface ProductoPromoSelectorProps {
  promocionesProducto: Promocion[];
  value: SeleccionProducto;
  onChange: (sel: SeleccionProducto) => void;
}

export function ProductoPromoSelector({
  promocionesProducto,
  value,
  onChange,
}: ProductoPromoSelectorProps) {
  return (
    <div className="space-y-3">
      {promocionesProducto.length > 0 && (
        <>
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-muted">
            <LuTag className="h-3.5 w-3.5" />
            Promociones de producto
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {promocionesProducto.map((promo) => {
              const selected =
                value.kind === "promo" && value.promo.id === promo.id;
              return (
                <button
                  key={promo.id}
                  type="button"
                  onClick={() => onChange({ kind: "promo", promo })}
                  className={cn(
                    "flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors duration-150",
                    selected
                      ? "border-brand-green bg-brand-green/10"
                      : "border-border bg-surface hover:border-text-muted"
                  )}
                >
                  <p
                    className={cn(
                      "truncate text-sm font-medium",
                      selected ? "text-brand-green" : "text-text-primary"
                    )}
                  >
                    {promo.nombre}
                  </p>
                  <p
                    className={cn(
                      "mt-1 font-mono text-base font-bold tabular-nums",
                      selected ? "text-brand-green" : "text-text-primary"
                    )}
                  >
                    {formatMoneda(promo.precio)}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => onChange({ kind: "custom" })}
        className={cn(
          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
          value.kind === "custom"
            ? "border-brand-green bg-brand-green/10 text-brand-green"
            : "border-border bg-surface text-text-secondary hover:text-text-primary"
        )}
      >
        {promocionesProducto.length === 0
          ? "Capturar monto"
          : "Capturar monto personalizado"}
      </button>
    </div>
  );
}
