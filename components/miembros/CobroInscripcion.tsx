"use client";

import { useEffect, useState } from "react";
import {
  LuWallet,
  LuCreditCard,
  LuArrowLeftRight,
} from "react-icons/lu";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { cn } from "@/lib/utils/cn";
import { formatFecha } from "@/lib/utils/format";
import { duracionPresets, type DuracionPreset } from "@/lib/utils/membresia-rango";
import {
  PlanPromoSelector,
  type SeleccionMembresia,
} from "@/components/caja/PlanPromoSelector";
import type { PlanMembresia } from "@/lib/queries/planes.queries";
import type { Promocion } from "@/lib/queries/promociones.queries";

type Metodo = "efectivo" | "tarjeta" | "transferencia";

interface CobroInscripcionProps {
  planes: PlanMembresia[];
  promocionesMembresia: Promocion[];
  fieldErrors: Partial<Record<string, string>>;
}

const metodoOptions: { value: Metodo; label: string; icon: React.ReactNode }[] =
  [
    { value: "efectivo", label: "Efectivo", icon: <LuWallet className="h-4 w-4" /> },
    { value: "tarjeta", label: "Tarjeta", icon: <LuCreditCard className="h-4 w-4" /> },
    {
      value: "transferencia",
      label: "Transferencia",
      icon: <LuArrowLeftRight className="h-4 w-4" />,
    },
  ];

const customPresets: DuracionPreset[] = [
  "1_semana",
  "15_dias",
  "1_mes",
  "3_meses",
  "6_meses",
  "anual",
];

/** Rango desde hoy por una cantidad de días (miembro nuevo, sin vigencia previa). */
function rangoDesdeHoy(dias: number): { inicio: string; fin: string } {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(hoy);
  fin.setDate(fin.getDate() + dias - 1);
  const toISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  return { inicio: toISO(hoy), fin: toISO(fin) };
}

export function CobroInscripcion({
  planes,
  promocionesMembresia,
  fieldErrors,
}: CobroInscripcionProps) {
  const [enabled, setEnabled] = useState(false);
  const [selMem, setSelMem] = useState<SeleccionMembresia>({ kind: "custom" });
  const [customPreset, setCustomPreset] = useState<DuracionPreset | "manual">(
    "1_mes"
  );
  const [montoCustom, setMontoCustom] = useState("");
  const [metodo, setMetodo] = useState<Metodo>("efectivo");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFin, setPeriodoFin] = useState("");

  // Derivar monto, plan_id, promocion_id según selección.
  const { montoFinal, planId, promocionId } = (() => {
    if (selMem.kind === "plan") {
      return {
        montoFinal: selMem.plan.precio,
        planId: selMem.plan.id,
        promocionId: "",
      };
    }
    if (selMem.kind === "promo") {
      return {
        montoFinal: selMem.promo.precio,
        planId: "",
        promocionId: selMem.promo.id,
      };
    }
    return {
      montoFinal: Number(montoCustom) || 0,
      planId: "",
      promocionId: "",
    };
  })();

  // Recalcular periodo según selección.
  useEffect(() => {
    if (selMem.kind === "plan") {
      const r = rangoDesdeHoy(selMem.plan.dias_duracion);
      setPeriodoInicio(r.inicio);
      setPeriodoFin(r.fin);
    } else if (selMem.kind === "promo" && selMem.promo.dias_duracion) {
      const r = rangoDesdeHoy(selMem.promo.dias_duracion);
      setPeriodoInicio(r.inicio);
      setPeriodoFin(r.fin);
    } else if (selMem.kind === "custom" && customPreset !== "manual") {
      const r = rangoDesdeHoy(duracionPresets[customPreset].dias);
      setPeriodoInicio(r.inicio);
      setPeriodoFin(r.fin);
    }
  }, [selMem, customPreset]);

  return (
    <div className="rounded-xl border border-border bg-bg/40">
      <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-brand-green"
        />
        <span className="text-sm font-medium text-text-primary">
          Cobrar primera membresía
        </span>
      </label>

      {/* Hidden inputs siempre presentes para el server action. */}
      <input
        type="hidden"
        name="cobrar_inscripcion"
        value={enabled ? "true" : "false"}
      />
      <input type="hidden" name="plan_id" value={enabled ? planId : ""} />
      <input
        type="hidden"
        name="promocion_id"
        value={enabled ? promocionId : ""}
      />
      <input
        type="hidden"
        name="monto_pago"
        value={enabled ? montoFinal : ""}
      />
      <input type="hidden" name="metodo_pago" value={enabled ? metodo : ""} />
      <input
        type="hidden"
        name="periodo_inicio"
        value={enabled ? periodoInicio : ""}
      />
      <input
        type="hidden"
        name="periodo_fin"
        value={enabled ? periodoFin : ""}
      />

      {enabled && (
        <div className="space-y-4 border-t border-border px-4 py-4">
          <div className="space-y-3">
            <Label>Plan o promoción</Label>
            <PlanPromoSelector
              planes={planes}
              promocionesMembresia={promocionesMembresia}
              value={selMem}
              onChange={setSelMem}
            />
          </div>

          {selMem.kind === "custom" && (
            <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
              <div className="space-y-2">
                <Label>Duración</Label>
                <div className="flex flex-wrap gap-2">
                  {customPresets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCustomPreset(p)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                        customPreset === p
                          ? "border-brand-green bg-brand-green/10 text-brand-green"
                          : "border-border bg-surface text-text-secondary hover:text-text-primary"
                      )}
                    >
                      {duracionPresets[p].label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCustomPreset("manual")}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                      customPreset === "manual"
                        ? "border-brand-green bg-brand-green/10 text-brand-green"
                        : "border-border bg-surface text-text-secondary hover:text-text-primary"
                    )}
                  >
                    Fechas manuales
                  </button>
                </div>
              </div>

              {customPreset === "manual" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Desde"
                    type="date"
                    value={periodoInicio}
                    onChange={(e) => setPeriodoInicio(e.target.value)}
                    error={fieldErrors.periodo_fin}
                  />
                  <Input
                    label="Hasta"
                    type="date"
                    value={periodoFin}
                    onChange={(e) => setPeriodoFin(e.target.value)}
                  />
                </div>
              )}

              <Input
                label="Monto"
                type="number"
                inputMode="decimal"
                step="1"
                min="0"
                value={montoCustom}
                onChange={(e) => setMontoCustom(e.target.value)}
                leftSlot="$"
                error={fieldErrors.monto_pago}
              />

              {customPreset !== "manual" && periodoInicio && periodoFin && (
                <p className="text-xs text-text-muted">
                  Vigencia: {formatFecha(periodoInicio)} →{" "}
                  {formatFecha(periodoFin)}
                </p>
              )}
            </div>
          )}

          {(selMem.kind === "plan" || selMem.kind === "promo") &&
            periodoInicio &&
            periodoFin && (
              <p className="text-xs text-text-muted">
                Vigencia: {formatFecha(periodoInicio)} →{" "}
                {formatFecha(periodoFin)}
              </p>
            )}

          {/* Método de pago */}
          <div className="space-y-1.5">
            <Label>Método de pago</Label>
            <div className="grid grid-cols-3 gap-2">
              {metodoOptions.map((opt) => {
                const active = metodo === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMetodo(opt.value)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors duration-150",
                      active
                        ? "border-brand-green bg-brand-green/10 text-brand-green"
                        : "border-border bg-surface text-text-secondary hover:text-text-primary"
                    )}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <p className="text-xs uppercase tracking-wider text-text-muted">
              Total a cobrar
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums text-brand-green">
              ${montoFinal.toLocaleString("es-MX")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
