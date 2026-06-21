"use client";

import { LuTag, LuPackage, LuChevronDown } from "react-icons/lu";
import { cn } from "@/lib/utils/cn";
import { formatMoneda } from "@/lib/utils/format";
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
}

export function PlanPromoSelector({
  planes,
  promocionesMembresia,
  value,
  onChange,
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

      <div>
        <button
          type="button"
          onClick={() => onChange({ kind: "custom" })}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
            value.kind === "custom"
              ? "border-brand-green bg-brand-green/10 text-brand-green"
              : "border-border bg-surface text-text-secondary hover:text-text-primary"
          )}
        >
          Personalizar precio y duración
          <LuChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              value.kind === "custom" && "rotate-180"
            )}
          />
        </button>
      </div>
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
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-muted">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

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
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors duration-150",
        selected
          ? "border-brand-green bg-brand-green/10"
          : "border-border bg-surface hover:border-text-muted"
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
        {badge && (
          <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs text-text-secondary">{subtitle}</p>
      <p
        className={cn(
          "mt-1 font-mono text-base font-bold tabular-nums",
          selected ? "text-brand-green" : "text-text-primary"
        )}
      >
        {price}
      </p>
    </button>
  );
}
