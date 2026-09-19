"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  LuSearch,
  LuX,
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
  registrarAbonoAction,
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
  /** "Enviar por WhatsApp" tras el cobro es Pro (feature whatsapp_manual). */
  canWhatsapp?: boolean;
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
  canWhatsapp = true,
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
  // Ciclos de facturación fijos (17→17, 20→20…): con un plan/promo elegido,
  // permite ajustar las fechas sin perder el plan_id (a diferencia del
  // monto personalizado, que sí lo suelta).
  const [fechasPersonalizadas, setFechasPersonalizadas] = useState(false);
  // Abono: cobra parte del precio del plan hoy, el resto queda pendiente en
  // Cuentas por Cobrar. Va por una action aparte (registrarAbonoAction), no
  // por pagoSchema — necesita su propio pending/submit.
  const [esAbono, setEsAbono] = useState(false);
  const [montoAbono, setMontoAbono] = useState("");
  const [isPendingAbono, startAbono] = useTransition();

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
    // Fechas personalizadas: el staff las controla a mano, no se recalculan.
    if (fechasPersonalizadas && (selMem.kind === "plan" || selMem.kind === "promo")) {
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
  }, [selMem, miembro, customPreset, requierePeriodo, fechasPersonalizadas]);

  // Al cambiar de plan/promo, las fechas personalizadas y el abono ya no
  // aplican (evita dejar un rango o monto viejo pegado a una selección nueva).
  useEffect(() => {
    setFechasPersonalizadas(false);
    setEsAbono(false);
    setMontoAbono("");
  }, [selMem.kind]);

  // Reset al cambiar concepto
  useEffect(() => {
    setSelMem(
      planes.length > 0 ? { kind: "plan", plan: planes[0] } : { kind: "custom" }
    );
    setSelProd({ kind: "custom" });
    setMontoCustom("");
    setCustomPreset("1_mes");
    setCantidadProducto(1);
    setFechasPersonalizadas(false);
    setEsAbono(false);
    setMontoAbono("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concepto]);

  // Reset cantidad cuando cambia producto
  useEffect(() => {
    setCantidadProducto(1);
  }, [selProd]);

  // Reset compartido tras un cobro exitoso — sea pago normal o abono. Una
  // sola fuente de verdad evita que los dos caminos se desincronicen (ej.
  // que uno limpie "paga con"/fechas personalizadas y el otro no).
  function resetPagoForm() {
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
    setFechasPersonalizadas(false);
    setEsAbono(false);
    setMontoAbono("");
  }

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
      resetPagoForm();
    } else if (state.error && Object.keys(state.fieldErrors).length === 0) {
      toastError("No se pudo registrar", state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, success, toastError]);

  const maxCantidad =
    selProd.kind === "producto" ? selProd.producto.stock_actual : null;

  // Validación inline del abono (se muestra antes de intentar enviar, no
  // solo como toast tras el clic).
  const abonoError =
    esAbono && selMem.kind === "plan" && montoAbono.trim() !== ""
      ? Number(montoAbono) <= 0 || Number(montoAbono) >= selMem.plan.precio
        ? "El abono debe ser mayor a 0 y menor al precio del plan."
        : null
      : null;

  function handleAbono() {
    if (!miembro) {
      toastError("Falta el miembro", "Selecciona un miembro.");
      return;
    }
    if (selMem.kind !== "plan") return;
    const monto = Number(montoAbono);
    if (!(monto > 0) || monto >= selMem.plan.precio) {
      toastError(
        "Monto inválido",
        "El abono debe ser mayor a 0 y menor al precio del plan."
      );
      return;
    }
    startAbono(async () => {
      const r = await registrarAbonoAction(
        miembro.id,
        selMem.plan.id,
        monto,
        metodo
      );
      if (!r.ok) {
        toastError("No se pudo registrar el abono", r.error ?? "Inténtalo de nuevo");
        return;
      }
      success(
        "Abono registrado",
        r.montoRestante
          ? `Pendiente: ${formatMoneda(r.montoRestante)}`
          : undefined
      );
      setLastPago({
        nombre: miembro.nombre,
        telefono: miembro.telefono,
        montoStr: formatMoneda(monto),
        fechaStr: null,
        pagoId: r.pagoId,
      });
      resetPagoForm();
    });
  }

  return (
    <div className="space-y-4">
      {lastPago && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-bg px-4 py-3">
          <p className="text-sm text-text-primary">
            Pago registrado ·{" "}
            <span className="font-medium">{lastPago.nombre}</span>
          </p>
          <div className="flex items-center gap-2">
            {canWhatsapp && lastPago.telefono && (
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
                className="inline-flex h-9 items-center gap-2 bg-whatsapp px-3 text-sm font-semibold text-on-brand transition-colors hover:bg-whatsapp/90"
              >
                <LuMessageCircle className="h-4 w-4" />
                Enviar por WhatsApp
              </a>
            )}
            {lastPago.pagoId && (
              <Link
                href={`/${slug}/recibos/${lastPago.pagoId}`}
                className="inline-flex h-9 items-center gap-2 border border-border px-3 text-sm text-text-primary transition-colors hover:border-text-secondary"
              >
                <LuReceipt className="h-4 w-4" />
                Ver recibo
              </Link>
            )}
            <button
              type="button"
              onClick={() => setLastPago(null)}
              aria-label="Cerrar"
              className="flex h-9 w-9 items-center justify-center text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
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
                aria-pressed={active}
                className={cn(
                  "inline-flex h-11 items-center justify-center border px-3 text-sm font-medium transition-colors duration-150",
                  active
                    ? "border-brand-green bg-surface-hover text-brand-green"
                    : "border-border bg-bg text-text-secondary hover:border-text-secondary hover:text-text-primary"
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
          <Label required={concepto === "membresia"}>
            Miembro
            {concepto === "visita" && (
              <span className="ml-1 font-normal text-text-muted">
                (opcional)
              </span>
            )}
          </Label>
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
            <p role="alert" className="text-sm text-danger">
              {state.fieldErrors.miembro_id}
            </p>
          )}

          {/* Visita sin miembro: datos opcionales del visitante no inscrito. */}
          {concepto === "visita" && !miembro && (
            <div className="grid gap-3 border border-border bg-bg p-4 sm:grid-cols-2">
              <p className="text-sm text-text-muted sm:col-span-2">
                ¿No está inscrito? Registra la visita sin miembro. Si dejas el
                nombre vacío aparecerá como “Visitante”.
              </p>
              <Input
                label="Nombre del visitante"
                name="nombre_visitante"
                placeholder="Ej. Juan Pérez"
                error={state.fieldErrors.nombre_visitante}
              />
              <Input
                label="Teléfono"
                name="telefono_visitante"
                type="tel"
                placeholder="55 1234 5678"
                error={state.fieldErrors.telefono_visitante}
              />
            </div>
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
            periodoFin &&
            (fechasPersonalizadas ? (
              <div className="grid gap-3 border border-border bg-bg p-4 sm:grid-cols-2">
                <Input
                  label="Desde"
                  type="date"
                  value={periodoInicio}
                  onChange={(e) => setPeriodoInicio(e.target.value)}
                  error={state.fieldErrors.periodo_inicio}
                />
                <Input
                  label="Hasta"
                  type="date"
                  value={periodoFin}
                  onChange={(e) => setPeriodoFin(e.target.value)}
                  error={state.fieldErrors.periodo_fin}
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

          {selMem.kind === "plan" && miembro && (
            <div className="border border-border bg-bg p-4">
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={esAbono}
                  onChange={(e) => {
                    setEsAbono(e.target.checked);
                    if (e.target.checked) setFechasPersonalizadas(false);
                  }}
                  className="h-4 w-4 rounded border-border accent-brand-green"
                />
                <span className="text-sm font-medium text-text-primary">
                  Registrar como abono (pago parcial)
                </span>
              </label>

              {esAbono && (
                <div className="mt-3 space-y-2">
                  <Input
                    label="¿Cuánto paga hoy?"
                    type="number"
                    inputMode="decimal"
                    step="1"
                    min="0"
                    max={selMem.plan.precio - 1}
                    value={montoAbono}
                    onChange={(e) => setMontoAbono(e.target.value)}
                    leftSlot="$"
                    error={abonoError ?? undefined}
                  />
                  {Number(montoAbono) > 0 &&
                    Number(montoAbono) < selMem.plan.precio && (
                      <p className="text-sm text-text-muted">
                        Queda pendiente:{" "}
                        <span className="font-mono text-dato text-text-primary">
                          {formatMoneda(selMem.plan.precio - Number(montoAbono))}
                        </span>{" "}
                        — aparece en Cuentas por cobrar.
                      </p>
                    )}
                </div>
              )}
            </div>
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

      {/* Método: el seleccionado es el único verde del formulario, junto
          con el botón de cobrar. */}
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
                    : "border-border bg-bg text-text-secondary hover:border-text-secondary hover:text-text-primary"
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
        <div className="space-y-2">
          <Label htmlFor="pago-paga-con">Paga con (opcional)</Label>
          <input
            id="pago-paga-con"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={pagaCon}
            onChange={(e) => setPagaCon(e.target.value)}
            placeholder="0.00"
            className="h-11 w-full rounded border border-border bg-bg px-3 font-mono text-sm tabular-nums text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
          />
          {pagaCon.trim() !== "" && Number(pagaCon) >= montoFinal && (
            <p className="flex items-center justify-between border border-border px-3 py-2 text-sm text-text-secondary">
              <span>Cambio</span>
              <span className="font-mono text-dato tabular-nums text-text-primary">
                ${(Number(pagaCon) - montoFinal).toLocaleString("es-MX")}
              </span>
            </p>
          )}
          {pagaCon.trim() !== "" && Number(pagaCon) < montoFinal && (
            <p className="flex items-center justify-between border border-danger/40 px-3 py-2 text-sm text-danger">
              <span>Falta</span>
              <span className="font-mono text-dato tabular-nums">
                ${(montoFinal - Number(pagaCon)).toLocaleString("es-MX")}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Nota de crédito del miembro (B2b) */}
      {miembro && creditoDisponible > 0 && montoFinal > 0 && (
        <div className="space-y-2 border border-border bg-bg p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="pago-credito">Crédito disponible</Label>
            <span className="font-mono text-dato tabular-nums text-text-primary">
              {formatMoneda(creditoDisponible)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="pago-credito"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={creditoAplicar}
              onChange={(e) => setCreditoAplicar(e.target.value)}
              placeholder="0.00"
              className="h-11 w-full rounded border border-border bg-bg px-3 font-mono text-sm tabular-nums text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
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

      {/* Total + cobrar: cifra en mono 36px y botón primario a todo lo ancho */}
      <div className="flex flex-col gap-4 border-t border-border pt-5">
        <div className="flex items-end justify-between gap-4">
          <p className="font-mono text-etiqueta uppercase text-text-secondary">
            {esAbono
              ? "Abono a cobrar hoy"
              : creditoAplicado > 0
                ? "A cobrar (menos crédito)"
                : "Total"}
          </p>
          {!esAbono && creditoAplicado > 0 && (
            <p className="text-sm text-text-muted">
              Total ${montoFinal.toLocaleString("es-MX")} − crédito $
              {creditoAplicado.toLocaleString("es-MX")}
            </p>
          )}
        </div>
        <p className="font-mono text-[36px] font-bold leading-10 tabular-nums text-text-primary">
          {formatMoneda(esAbono ? Number(montoAbono) || 0 : montoNeto)}
        </p>
        {esAbono ? (
          <Button
            type="button"
            onClick={handleAbono}
            loading={isPendingAbono}
            disabled={!montoAbono.trim() || !!abonoError}
            size="lg"
            className="w-full"
          >
            Registrar abono · {formatMoneda(Number(montoAbono) || 0)}
          </Button>
        ) : (
          <Button type="submit" loading={isPending} size="lg" className="w-full">
            Registrar pago · {formatMoneda(montoNeto)}
          </Button>
        )}
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
    <div className="space-y-4 border border-border bg-bg p-4">
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
                aria-pressed={active}
                className={cn(
                  "inline-flex h-9 items-center border px-3 text-sm transition-colors duration-150",
                  active
                    ? "border-brand-green bg-surface-hover text-brand-green"
                    : "border-border text-text-secondary hover:border-text-secondary hover:text-text-primary"
                )}
              >
                {duracionPresets[p].label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setCustomPreset("manual")}
            aria-pressed={customPreset === "manual"}
            className={cn(
              "inline-flex h-9 items-center border px-3 text-sm transition-colors duration-150",
              customPreset === "manual"
                ? "border-brand-green bg-surface-hover text-brand-green"
                : "border-border text-text-secondary hover:border-text-secondary hover:text-text-primary"
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
        <p className="text-sm text-text-muted">
          Vigencia:{" "}
          <span className="font-mono text-dato text-text-secondary">
            {formatFecha(periodoInicio)} → {formatFecha(periodoFin)}
          </span>
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
    <div className="flex items-center gap-3 border border-border bg-bg py-1 pl-4 pr-1">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-5 text-text-primary">
          {miembro.nombre}
        </p>
        <p className="truncate text-sm text-text-muted">
          {miembro.fecha_vencimiento
            ? `Vence el ${formatFecha(miembro.fecha_vencimiento)}`
            : "Sin membresía vigente"}
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label="Quitar selección"
        className="flex h-11 w-11 shrink-0 items-center justify-center text-text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary"
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
        autoFocus
      />

      {(results.length > 0 || (query.trim().length >= 2 && !isSearching)) && (
        <div className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden border border-border bg-surface">
          {results.length === 0 ? (
            <div className="px-4 py-4 text-center text-sm text-text-muted">
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
                    className="flex min-h-11 w-full items-center justify-between gap-4 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                  >
                    <span className="truncate text-[15px] leading-5 text-text-primary">
                      {m.nombre}
                    </span>
                    {m.telefono && (
                      <span className="shrink-0 font-mono text-dato text-text-muted">
                        {m.telefono}
                      </span>
                    )}
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
