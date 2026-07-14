"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  LuSearch,
  LuX,
  LuUser,
  LuWallet,
  LuCreditCard,
  LuArrowLeftRight,
  LuMessageCircle,
  LuReceipt,
} from "react-icons/lu";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";
import { formatFecha, formatMoneda } from "@/lib/utils/format";
import {
  buildWhatsAppUrl,
  mensajePagoRegistrado,
} from "@/lib/utils/whatsapp";
import {
  calcularRangoMembresia,
  calcularRangoPorDias,
  duracionPresets,
  type DuracionPreset,
} from "@/lib/utils/membresia-rango";
import { searchMiembrosAction } from "@/app/(tenant)/[slug]/checkins/actions";
import {
  registerPagoAction,
  getCreditoDisponibleAction,
  type PagoResult,
} from "@/app/(tenant)/[slug]/caja/actions";
import type { PlanMembresia } from "@/lib/queries/planes.queries";
import type { Promocion } from "@/lib/queries/promociones.queries";
import type { ProductoConStock } from "@/lib/queries/productos.queries";
import {
  PlanPromoSelector,
  type SeleccionMembresia,
} from "./PlanPromoSelector";
import {
  ProductoPromoSelector,
  type SeleccionProducto,
} from "./ProductoPromoSelector";

type Concepto = "membresia" | "visita" | "producto" | "otro";
type Metodo = "efectivo" | "tarjeta" | "transferencia";

interface MiembroLite {
  id: string;
  nombre: string;
  telefono: string | null;
  fecha_vencimiento: string | null;
}

interface PagoFormProps {
  slug: string;
  planes: PlanMembresia[];
  promocionesMembresia: Promocion[];
  promocionesProducto: Promocion[];
  productos: ProductoConStock[];
}

const initial: PagoResult = { ok: false, error: null, fieldErrors: {} };

const conceptoOptions: { value: Concepto; label: string }[] = [
  { value: "membresia", label: "Membresía" },
  { value: "visita", label: "Visita" },
  { value: "producto", label: "Producto" },
  { value: "otro", label: "Otro" },
];

const metodoOptions: { value: Metodo; label: string; icon: React.ReactNode }[] =
  [
    {
      value: "efectivo",
      label: "Efectivo",
      icon: <LuWallet className="h-4 w-4" />,
    },
    {
      value: "tarjeta",
      label: "Tarjeta",
      icon: <LuCreditCard className="h-4 w-4" />,
    },
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

export function PagoForm({
  slug,
  planes,
  promocionesMembresia,
  promocionesProducto,
  productos,
}: PagoFormProps) {
  const { success, error: toastError } = useToast();
  const [state, formAction, isPending] = useActionState(
    registerPagoAction,
    initial
  );
  const formRef = useRef<HTMLFormElement>(null);

  const [concepto, setConcepto] = useState<Concepto>("membresia");
  const [metodo, setMetodo] = useState<Metodo>("efectivo");
  // "Paga con" para calcular el cambio en efectivo (solo display, no se envía).
  const [pagaCon, setPagaCon] = useState("");
  const [miembro, setMiembro] = useState<MiembroLite | null>(null);
  // Nota de crédito del miembro (B2b): saldo disponible + monto a aplicar.
  const [creditoDisponible, setCreditoDisponible] = useState(0);
  const [creditoAplicar, setCreditoAplicar] = useState("");

  useEffect(() => {
    const id = miembro?.id;
    if (!id) return;
    let cancelado = false;
    getCreditoDisponibleAction(id).then((c) => {
      if (!cancelado) setCreditoDisponible(c);
    });
    return () => {
      cancelado = true;
    };
  }, [miembro?.id]);

  // Por defecto se selecciona el primer plan (panel de personalización
  // colapsado). "Personalizar precio y duración" lo expande on-demand.
  const defaultSelMem: SeleccionMembresia =
    planes.length > 0 ? { kind: "plan", plan: planes[0] } : { kind: "custom" };

  const [selMem, setSelMem] = useState<SeleccionMembresia>(defaultSelMem);
  const [selProd, setSelProd] = useState<SeleccionProducto>({ kind: "custom" });

  const [customPreset, setCustomPreset] = useState<DuracionPreset | "manual">(
    "1_mes"
  );
  const [montoCustom, setMontoCustom] = useState<string>("");
  const [cantidadProducto, setCantidadProducto] = useState<number>(1);
  const [periodoInicio, setPeriodoInicio] = useState<string>("");
  const [periodoFin, setPeriodoFin] = useState<string>("");

  // Panel de confirmación tras un pago exitoso (botón WhatsApp + recibo).
  const [lastPago, setLastPago] = useState<{
    nombre: string;
    telefono: string | null;
    montoStr: string;
    fechaStr: string | null;
    pagoId?: string;
  } | null>(null);

  const requiereMiembro = concepto === "membresia" || concepto === "visita";
  const requierePeriodo = concepto === "membresia";

  // Derivar valores según selección y concepto
  const { montoFinal, planId, promocionId, productoId } = (() => {
    if (concepto === "membresia") {
      if (selMem.kind === "plan") {
        return {
          montoFinal: selMem.plan.precio,
          planId: selMem.plan.id,
          promocionId: "",
          productoId: "",
        };
      }
      if (selMem.kind === "promo") {
        return {
          montoFinal: selMem.promo.precio,
          planId: "",
          promocionId: selMem.promo.id,
          productoId: "",
        };
      }
      return {
        montoFinal: Number(montoCustom) || 0,
        planId: "",
        promocionId: "",
        productoId: "",
      };
    }

    if (concepto === "producto") {
      if (selProd.kind === "producto") {
        return {
          montoFinal: selProd.producto.precio * cantidadProducto,
          planId: "",
          promocionId: "",
          productoId: selProd.producto.id,
        };
      }
      if (selProd.kind === "promo") {
        return {
          montoFinal: selProd.promo.precio,
          planId: "",
          promocionId: selProd.promo.id,
          productoId: "",
        };
      }
      return {
        montoFinal: Number(montoCustom) || 0,
        planId: "",
        promocionId: "",
        productoId: "",
      };
    }

    return {
      montoFinal: Number(montoCustom) || 0,
      planId: "",
      promocionId: "",
      productoId: "",
    };
  })();

  // Crédito aplicable (B2b): acotado al saldo y al total.
  const creditoAplicado = Math.max(
    0,
    Math.min(Number(creditoAplicar) || 0, creditoDisponible, montoFinal)
  );
  const montoNeto = montoFinal - creditoAplicado;

  // Recalcular rango cuando cambia selección/miembro
  useEffect(() => {
    if (!requierePeriodo) {
      setPeriodoInicio("");
      setPeriodoFin("");
      return;
    }

    if (selMem.kind === "plan") {
      const rango = calcularRangoPorDias(
        selMem.plan.dias_duracion,
        miembro?.fecha_vencimiento
      );
      setPeriodoInicio(rango.periodo_inicio);
      setPeriodoFin(rango.periodo_fin);
    } else if (selMem.kind === "promo" && selMem.promo.dias_duracion) {
      const rango = calcularRangoPorDias(
        selMem.promo.dias_duracion,
        miembro?.fecha_vencimiento
      );
      setPeriodoInicio(rango.periodo_inicio);
      setPeriodoFin(rango.periodo_fin);
    } else if (selMem.kind === "custom") {
      if (customPreset === "manual") return;
      const rango = calcularRangoMembresia(
        customPreset,
        miembro?.fecha_vencimiento
      );
      setPeriodoInicio(rango.periodo_inicio);
      setPeriodoFin(rango.periodo_fin);
    }
  }, [selMem, miembro, customPreset, requierePeriodo]);

  // Reset al cambiar concepto
  useEffect(() => {
    setSelMem(
      planes.length > 0 ? { kind: "plan", plan: planes[0] } : { kind: "custom" }
    );
    setSelProd({ kind: "custom" });
    setMontoCustom("");
    setCustomPreset("1_mes");
    setCantidadProducto(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concepto]);

  // Reset cantidad cuando cambia producto
  useEffect(() => {
    setCantidadProducto(1);
  }, [selProd]);

  // Success
  useEffect(() => {
    if (state.ok) {
      success("Pago registrado");
      // Captura datos del pago para el panel de confirmación (WhatsApp/recibo)
      // ANTES de resetear el form.
      if (miembro) {
        setLastPago({
          nombre: miembro.nombre,
          telefono: miembro.telefono,
          montoStr: formatMoneda(montoFinal),
          fechaStr: periodoFin ? formatFecha(periodoFin) : null,
          pagoId: state.pagoId,
        });
      } else {
        setLastPago(null);
      }
      formRef.current?.reset();
      setMiembro(null);
      setConcepto("membresia");
      setMetodo("efectivo");
      setPagaCon("");
      setCreditoAplicar("");
      setSelMem(defaultSelMem);
      setSelProd({ kind: "custom" });
      setCustomPreset("1_mes");
      setMontoCustom("");
      setCantidadProducto(1);
    } else if (state.error && Object.keys(state.fieldErrors).length === 0) {
      toastError("No se pudo registrar", state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, success, toastError]);

  const maxCantidad =
    selProd.kind === "producto" ? selProd.producto.stock_actual : null;

  return (
    <div className="space-y-4">
      {lastPago && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-green/30 bg-brand-green/5 px-4 py-3">
          <p className="text-sm text-text-primary">
            Pago registrado ·{" "}
            <span className="font-medium">{lastPago.nombre}</span>
          </p>
          <div className="flex items-center gap-2">
            {lastPago.telefono && (
              <a
                href={buildWhatsAppUrl(
                  lastPago.telefono,
                  mensajePagoRegistrado(
                    lastPago.nombre,
                    lastPago.montoStr,
                    lastPago.fechaStr
                  )
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
              >
                <LuMessageCircle className="h-3.5 w-3.5" />
                Enviar por WhatsApp
              </a>
            )}
            {lastPago.pagoId && (
              <Link
                href={`/${slug}/recibos/${lastPago.pagoId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                <LuReceipt className="h-3.5 w-3.5" />
                Ver recibo
              </Link>
            )}
            <button
              type="button"
              onClick={() => setLastPago(null)}
              aria-label="Cerrar"
              className="rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary"
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <form ref={formRef} action={formAction} className="space-y-6">
      {/* Concepto */}
      <div className="space-y-2">
        <Label>Concepto</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {conceptoOptions.map((opt) => {
            const active = concepto === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setConcepto(opt.value)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                  active
                    ? "border-brand-green bg-brand-green/10 text-brand-green"
                    : "border-border bg-surface text-text-secondary hover:border-text-muted hover:text-text-primary"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="concepto" value={concepto} />
      </div>

      {/* Miembro */}
      {requiereMiembro && (
        <div className="space-y-2">
          <Label required>Miembro</Label>
          {miembro ? (
            <SelectedMiembroChip
              miembro={miembro}
              onClear={() => {
                setMiembro(null);
                setCreditoDisponible(0);
                setCreditoAplicar("");
              }}
            />
          ) : (
            <MiembroAutocomplete
              onSelect={(m) => {
                setMiembro(m);
                setCreditoAplicar("");
              }}
            />
          )}
          <input type="hidden" name="miembro_id" value={miembro?.id ?? ""} />
          {state.fieldErrors.miembro_id && (
            <p role="alert" className="text-xs text-danger">
              {state.fieldErrors.miembro_id}
            </p>
          )}
        </div>
      )}

      {/* Membresía */}
      {concepto === "membresia" && (
        <div className="space-y-3">
          <Label>Plan o promoción</Label>
          <PlanPromoSelector
            planes={planes}
            promocionesMembresia={promocionesMembresia}
            value={selMem}
            onChange={setSelMem}
          />

          {selMem.kind === "custom" && (
            <CustomMembresiaInputs
              customPreset={customPreset}
              setCustomPreset={setCustomPreset}
              montoCustom={montoCustom}
              setMontoCustom={setMontoCustom}
              periodoInicio={periodoInicio}
              setPeriodoInicio={setPeriodoInicio}
              periodoFin={periodoFin}
              setPeriodoFin={setPeriodoFin}
              presets={customPresets}
              fieldErrors={state.fieldErrors}
            />
          )}

          {(selMem.kind === "plan" || selMem.kind === "promo") &&
            periodoInicio &&
            periodoFin && (
              <p className="text-xs text-text-muted">
                Vigencia: {formatFecha(periodoInicio)} →{" "}
                {formatFecha(periodoFin)}
              </p>
            )}
        </div>
      )}

      {/* Producto */}
      {concepto === "producto" && (
        <div className="space-y-3">
          <Label>Producto o promoción</Label>
          <ProductoPromoSelector
            productos={productos}
            promocionesProducto={promocionesProducto}
            value={selProd}
            onChange={setSelProd}
          />

          {selProd.kind === "producto" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Cantidad"
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                max={maxCantidad ?? undefined}
                value={cantidadProducto}
                onChange={(e) =>
                  setCantidadProducto(Math.max(1, Number(e.target.value) || 1))
                }
                description={
                  maxCantidad !== null
                    ? `Stock disponible: ${maxCantidad}`
                    : undefined
                }
              />
            </div>
          )}

          {selProd.kind === "custom" && (
            <Input
              label="Monto"
              type="number"
              inputMode="decimal"
              step="1"
              min="0"
              required
              value={montoCustom}
              onChange={(e) => setMontoCustom(e.target.value)}
              leftSlot="$"
              error={state.fieldErrors.monto}
            />
          )}
        </div>
      )}

      {/* Visita y otro */}
      {(concepto === "visita" || concepto === "otro") && (
        <Input
          label="Monto"
          type="number"
          inputMode="decimal"
          step="1"
          min="0"
          required
          value={montoCustom}
          onChange={(e) => setMontoCustom(e.target.value)}
          leftSlot="$"
          error={state.fieldErrors.monto}
        />
      )}

      {/* Método */}
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
        <input type="hidden" name="metodo_pago" value={metodo} />
      </div>

      {/* Paga con / cambio (solo efectivo) */}
      {metodo === "efectivo" && montoFinal > 0 && (
        <div className="space-y-1.5">
          <Label>Paga con (opcional)</Label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={pagaCon}
            onChange={(e) => setPagaCon(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
          />
          {pagaCon.trim() !== "" && Number(pagaCon) >= montoFinal && (
            <p className="flex items-center justify-between rounded-lg bg-brand-green/10 px-3 py-2 text-sm text-brand-green">
              <span>Cambio</span>
              <span className="font-mono font-semibold">
                ${(Number(pagaCon) - montoFinal).toLocaleString("es-MX")}
              </span>
            </p>
          )}
          {pagaCon.trim() !== "" && Number(pagaCon) < montoFinal && (
            <p className="flex items-center justify-between rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              <span>Falta</span>
              <span className="font-mono font-semibold">
                ${(montoFinal - Number(pagaCon)).toLocaleString("es-MX")}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Nota de crédito del miembro (B2b) */}
      {miembro && creditoDisponible > 0 && montoFinal > 0 && (
        <div className="space-y-1.5 rounded-lg border border-brand-green/20 bg-brand-green/5 p-3">
          <div className="flex items-center justify-between">
            <Label>Crédito disponible</Label>
            <span className="font-mono text-sm font-semibold text-brand-green">
              {formatMoneda(creditoDisponible)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={creditoAplicar}
              onChange={(e) => setCreditoAplicar(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setCreditoAplicar(String(Math.min(creditoDisponible, montoFinal)))
              }
            >
              Aplicar todo
            </Button>
          </div>
        </div>
      )}

      {/* Hidden fields */}
      <input type="hidden" name="monto" value={montoFinal} />
      <input type="hidden" name="credito_aplicado" value={creditoAplicado} />
      <input type="hidden" name="periodo_inicio" value={periodoInicio} />
      <input type="hidden" name="periodo_fin" value={periodoFin} />
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="promocion_id" value={promocionId} />
      <input type="hidden" name="producto_id" value={productoId} />
      <input
        type="hidden"
        name="cantidad_producto"
        value={productoId ? cantidadProducto : ""}
      />

      {/* Resumen + submit */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-text-muted">
            {creditoAplicado > 0 ? "A cobrar (menos crédito)" : "Total a cobrar"}
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-brand-green">
            ${montoNeto.toLocaleString("es-MX")}
          </p>
          {creditoAplicado > 0 && (
            <p className="text-[11px] text-text-secondary">
              Total ${montoFinal.toLocaleString("es-MX")} − crédito $
              {creditoAplicado.toLocaleString("es-MX")}
            </p>
          )}
        </div>
        <Button type="submit" loading={isPending} size="lg">
          Registrar pago
        </Button>
      </div>
      </form>
    </div>
  );
}

// ============================================================
// Subcomponentes
// ============================================================

function CustomMembresiaInputs({
  customPreset,
  setCustomPreset,
  montoCustom,
  setMontoCustom,
  periodoInicio,
  setPeriodoInicio,
  periodoFin,
  setPeriodoFin,
  presets,
  fieldErrors,
}: {
  customPreset: DuracionPreset | "manual";
  setCustomPreset: (p: DuracionPreset | "manual") => void;
  montoCustom: string;
  setMontoCustom: (v: string) => void;
  periodoInicio: string;
  setPeriodoInicio: (v: string) => void;
  periodoFin: string;
  setPeriodoFin: (v: string) => void;
  presets: DuracionPreset[];
  fieldErrors: Partial<Record<string, string>>;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-bg/40 p-4">
      <div className="space-y-2">
        <Label>Duración</Label>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => {
            const active = customPreset === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setCustomPreset(p)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                  active
                    ? "border-brand-green bg-brand-green/10 text-brand-green"
                    : "border-border bg-surface text-text-secondary hover:text-text-primary"
                )}
              >
                {duracionPresets[p].label}
              </button>
            );
          })}
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
            error={fieldErrors.periodo_inicio}
          />
          <Input
            label="Hasta"
            type="date"
            value={periodoFin}
            onChange={(e) => setPeriodoFin(e.target.value)}
            error={fieldErrors.periodo_fin}
          />
        </div>
      )}

      <Input
        label="Monto"
        type="number"
        inputMode="decimal"
        step="1"
        min="0"
        required
        value={montoCustom}
        onChange={(e) => setMontoCustom(e.target.value)}
        leftSlot="$"
        error={fieldErrors.monto}
      />

      {customPreset !== "manual" && periodoInicio && periodoFin && (
        <p className="text-xs text-text-muted">
          Vigencia: {formatFecha(periodoInicio)} → {formatFecha(periodoFin)}
        </p>
      )}
    </div>
  );
}

function SelectedMiembroChip({
  miembro,
  onClear,
}: {
  miembro: MiembroLite;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-brand-green/30 bg-brand-green/5 px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-brand-green">
        <LuUser className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-text-primary">
          {miembro.nombre}
        </p>
        <p className="truncate text-xs text-text-secondary">
          {miembro.fecha_vencimiento
            ? `Vence el ${formatFecha(miembro.fecha_vencimiento)}`
            : "Sin membresía vigente"}
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label="Quitar selección"
        className="shrink-0 rounded-md p-1 text-text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary"
      >
        <LuX className="h-4 w-4" />
      </button>
    </div>
  );
}

function MiembroAutocomplete({
  onSelect,
}: {
  onSelect: (m: MiembroLite) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MiembroLite[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const t = window.setTimeout(async () => {
      const r = await searchMiembrosAction(query);
      setResults(r);
      setIsSearching(false);
    }, 200);
    return () => window.clearTimeout(t);
  }, [query]);

  return (
    <div className="relative">
      <Input
        type="search"
        placeholder="Buscar miembro por nombre o teléfono…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        leftSlot={<LuSearch className="h-4 w-4" />}
        autoComplete="off"
      />

      {(results.length > 0 || (query.trim().length >= 2 && !isSearching)) && (
        <div className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          {results.length === 0 ? (
            <div className="px-4 py-4 text-center text-sm text-text-secondary">
              Sin resultados
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(m);
                      setQuery("");
                      setResults([]);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-text-muted">
                      <LuUser className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {m.nombre}
                      </p>
                      {m.telefono && (
                        <p className="truncate font-mono text-xs text-text-secondary">
                          {m.telefono}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
