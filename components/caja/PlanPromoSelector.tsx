"use client";

import { LuTag, LuPackage, LuChevronDown } from "react-icons/lu";
import { cn } from "@/lib/utils/cn";
import { formatMoneda } from "@/lib/utils/format";
import { Badge } from "@/components/ui/Badge";
import type { PlanMembresia } from "@/lib/queries/planes.queries";
import type { Promocion } from "@/lib/queries/promociones.queries";

export type SeleccionMembresia =
  | { kind: "plan"; plan: PlanMembresia }
  | { kind: "promo"; promo: Promocion }
  | { kind: "custom" };

interface PlanPromoSelectorProps {
  planes: PlanMembresia[];
  promocionesMembresia: Promocion[];
  value: SeleccionMembresia;
  onChange: (sel: SeleccionMembresia) => void;
  /** Permite elegir un monto/duración manual fuera de los planes/promos. Default true. */
  allowCustom?: boolean;
  /** true si `value` es un default preseleccionado, no una elección activa
   * todavía — marca esa tarjeta como "Sugerido" en vez de verse idéntica a
   * una elegida a propósito. */
  sugerido?: boolean;
}

export function PlanPromoSelector({
  planes,
  promocionesMembresia,
  value,
  onChange,
  allowCustom = true,
  sugerido = false,
}: PlanPromoSelectorProps) {
  return (
    <div className="space-y-4">
      {planes.length > 0 && (
        <Section title="Planes" icon={<LuPackage className="h-3.5 w-3.5" />}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {planes.map((p) => {
              const selected = value.kind === "plan" && value.plan.id === p.id;
              return (
                <SelectorCard
                  key={p.id}
                  selected={selected}
                  onClick={() => onChange({ kind: "plan", plan: p })}
                  title={p.nombre}
                  subtitle={`${p.dias_duracion} ${
                    p.dias_duracion === 1 ? "día" : "días"
                  }`}
                  price={formatMoneda(p.precio)}
                  badge={selected && sugerido ? "Sugerido" : undefined}
                />
              );
            })}
          </div>
        </Section>
      )}

      {promocionesMembresia.length > 0 && (
        <Section
          title="Promociones vigentes"
          icon={<LuTag className="h-3.5 w-3.5" />}
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {promocionesMembresia.map((promo) => {
              const selected =
                value.kind === "promo" && value.promo.id === promo.id;
              return (
                <SelectorCard
                  key={promo.id}
                  selected={selected}
                  onClick={() => onChange({ kind: "promo", promo })}
                  title={promo.nombre}
                  subtitle={
                    promo.dias_duracion
                      ? `${promo.dias_duracion} ${
                          promo.dias_duracion === 1 ? "día" : "días"
                        }`
                      : ""
                  }
                  price={formatMoneda(promo.precio)}
                  badge="Promo"
                />
              );
            })}
          </div>
        </Section>
      )}

      {allowCustom && (
        <div>
          <button
            type="button"
            onClick={() => onChange({ kind: "custom" })}
            aria-pressed={value.kind === "custom"}
            className={cn(
              "inline-flex h-9 items-center gap-2 border px-3 text-sm transition-colors duration-150",
              value.kind === "custom"
                ? "border-brand-green bg-surface-hover text-brand-green"
                : "border-border text-text-secondary hover:border-text-secondary hover:text-text-primary"
            )}
          >
            Personalizar precio y duración
            <LuChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                value.kind === "custom" && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 font-mono text-etiqueta uppercase text-text-muted">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

/** Tarjeta de plan/promo: seleccionada = fondo lleno + borde y texto en
 * ácido (mismo estado que el método de pago). */
function SelectorCard({
  selected,
  onClick,
  title,
  subtitle,
  price,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  price: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex min-h-11 flex-col gap-1 border p-3 text-left transition-colors duration-150",
        selected
          ? "border-brand-green bg-surface-hover"
          : "border-border bg-bg hover:border-text-secondary"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "truncate text-sm font-medium",
            selected ? "text-brand-green" : "text-text-primary"
          )}
        >
          {title}
        </p>
        {badge && <Badge variant="neutral">{badge}</Badge>}
      </div>
      <p className="text-sm text-text-muted">{subtitle}</p>
      <p
        className={cn(
          "mt-1 font-mono text-dato font-bold tabular-nums",
          selected ? "text-brand-green" : "text-text-primary"
        )}
      >
        {price}
      </p>
    </button>
  );
}
