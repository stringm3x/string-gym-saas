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
import { hoyISO } from "@/lib/utils/dates";
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

/** Rango desde hoy por una cantidad de días (miembro nuevo, sin vigencia previa). */
function rangoDesdeHoy(dias: number): { inicio: string; fin: string } {
  const hoy = new Date(hoyISO() + "T00:00:00");
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
  // Sin personalización manual: por default el primer plan (o promo si no
  // hay planes). Si el gym no tiene ninguno configurado, cae en "custom"
  // como estado vacío interno (sin UI para elegirlo ni editarlo).
  const [selMem, setSelMem] = useState<SeleccionMembresia>(
    planes.length > 0
      ? { kind: "plan", plan: planes[0] }
      : promocionesMembresia.length > 0
        ? { kind: "promo", promo: promocionesMembresia[0] }
        : { kind: "custom" }
  );
  // El default de arriba se ve igual que una elección activa (mismo borde
  // verde) — nada le decía al staff que era un default. Con esto, se avisa
  // hasta que alguien de verdad toque el selector.
  const [selTocado, setSelTocado] = useState(false);
  function cambiarSel(sel: SeleccionMembresia) {
    setSelTocado(true);
    setSelMem(sel);
  }
  const [metodo, setMetodo] = useState<Metodo>("efectivo");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFin, setPeriodoFin] = useState("");
  // Ciclos de facturación fijos (17→17, 20→20…): con un plan/promo elegido,
  // permite ajustar las fechas sin perder el plan_id.
  const [fechasPersonalizadas, setFechasPersonalizadas] = useState(false);

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
    return { montoFinal: 0, planId: "", promocionId: "" };
  })();

  // Recalcular periodo según selección.
  useEffect(() => {
    // Fechas personalizadas: el usuario las controla a mano, no se recalculan.
    if (fechasPersonalizadas && (selMem.kind === "plan" || selMem.kind === "promo")) {
      return;
    }
    if (selMem.kind === "plan") {
      const r = rangoDesdeHoy(selMem.plan.dias_duracion);
      setPeriodoInicio(r.inicio);
      setPeriodoFin(r.fin);
    } else if (selMem.kind === "promo" && selMem.promo.dias_duracion) {
      const r = rangoDesdeHoy(selMem.promo.dias_duracion);
      setPeriodoInicio(r.inicio);
      setPeriodoFin(r.fin);
    }
  }, [selMem, fechasPersonalizadas]);

  // Al cambiar de plan/promo, las fechas personalizadas ya no aplican.
  useEffect(() => {
    setFechasPersonalizadas(false);
  }, [selMem.kind]);

  return (
    <div className="border border-border bg-bg">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-4 py-3">
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
            {!selTocado && (
              <p className="text-sm text-warning">
                Sugerido: {selMem.kind === "plan" ? selMem.plan.nombre : selMem.kind === "promo" ? selMem.promo.nombre : ""}.
                Confírmalo o elige otro antes de registrar.
              </p>
            )}
            <PlanPromoSelector
              planes={planes}
              promocionesMembresia={promocionesMembresia}
              value={selMem}
              onChange={cambiarSel}
              allowCustom={false}
              sugerido={!selTocado}
            />
            {planes.length === 0 && promocionesMembresia.length === 0 && (
              <p className="text-sm text-text-muted">
                No hay planes ni promociones configurados. Crea uno en
                Configuración → Planes para poder cobrar la inscripción.
              </p>
            )}
            {fieldErrors.monto_pago && (
              <p role="alert" className="text-sm text-danger">
                {fieldErrors.monto_pago}
              </p>
            )}
          </div>

          {(selMem.kind === "plan" || selMem.kind === "promo") &&
            periodoInicio &&
            periodoFin &&
            (fechasPersonalizadas ? (
              <div className="grid gap-3 border border-border bg-surface p-4 sm:grid-cols-2">
                <Input
                  label="Desde"
                  type="date"
                  value={periodoInicio}
                  onChange={(e) => setPeriodoInicio(e.target.value)}
                  error={fieldErrors.periodo_inicio}
                />
                <Input
                  label="Hasta"
                  type="date"
                  value={periodoFin}
                  onChange={(e) => setPeriodoFin(e.target.value)}
                  error={fieldErrors.periodo_fin}
                />
                <button
                  type="button"
                  onClick={() => setFechasPersonalizadas(false)}
                  className="inline-flex h-9 items-center self-start text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline sm:col-span-2"
                >
                  Usar la vigencia del plan
                </button>
              </div>
            ) : (
              <p className="flex items-center justify-between gap-2 text-sm text-text-muted">
                <span>
                  Vigencia:{" "}
                  <span className="font-mono text-dato text-text-secondary">
                    {formatFecha(periodoInicio)} → {formatFecha(periodoFin)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setFechasPersonalizadas(true)}
                  className="inline-flex h-9 shrink-0 items-center text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
                >
                  Personalizar fechas
                </button>
              </p>
            ))}

          {/* Método de pago */}
          <div className="space-y-2">
            <Label>Método</Label>
            <div className="grid grid-cols-3 gap-2">
              {metodoOptions.map((opt) => {
                const active = metodo === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMetodo(opt.value)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex h-11 items-center justify-center gap-2 border px-2 text-sm font-medium transition-colors duration-150",
                      active
                        ? "border-brand-green bg-surface-hover text-brand-green"
                        : "border-border bg-surface text-text-secondary hover:border-text-secondary hover:text-text-primary"
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
          <div className="flex items-end justify-between gap-4 border-t border-border pt-4">
            <p className="font-mono text-etiqueta uppercase text-text-secondary">
              Total a cobrar
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums text-text-primary">
              ${montoFinal.toLocaleString("es-MX")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
