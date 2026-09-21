"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";
import { crearPlanPagoAction } from "@/app/(tenant)/[slug]/miembros/[id]/creditos-actions";
import { repartirMonto, fechasCuotas, money } from "@/lib/utils/creditos-calc";
import type {
  FrecuenciaCuota,
  MetodoPago,
  TipoPlanPago,
} from "@/lib/validations/creditos.schema";

const METODOS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
] as const satisfies readonly { value: MetodoPago; label: string }[];

interface PlanMembresiaOpt {
  id: string;
  nombre: string;
  precio: number;
}

interface ProductoOpt {
  id: string;
  nombre: string;
  precio: number;
  stock: number;
}

function fechaCorta(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
  });
}

export function PlanPagoForm({
  miembroId,
  planesMembresia,
  productos,
  onDone,
}: {
  miembroId: string;
  planesMembresia: PlanMembresiaOpt[];
  productos: ProductoOpt[];
  onDone: () => void;
}) {
  const router = useRouter();
  const { success, error: toastError, warning } = useToast();
  const [pending, start] = useTransition();

  const [tipo, setTipo] = useState<TipoPlanPago>("membresia");
  const [planId, setPlanId] = useState(planesMembresia[0]?.id ?? "");
  const [productoId, setProductoId] = useState(productos[0]?.id ?? "");
  const [cantidad, setCantidad] = useState(1);
  const [cuotas, setCuotas] = useState(3);
  const [frecuencia, setFrecuencia] = useState<FrecuenciaCuota>("quincenal");
  const [concepto, setConcepto] = useState("Membresía a plazos");
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [conceptoTocado, setConceptoTocado] = useState(false);

  const productoSel = productos.find((p) => p.id === productoId) ?? null;
  const planSel = planesMembresia.find((p) => p.id === planId) ?? null;

  // El total sale siempre del precio real del plan/producto — no es un
  // campo que el staff pueda escribir (antes lo era, sin ninguna relación
  // con lo que de verdad cuesta lo que se está financiando).
  const total =
    tipo === "membresia"
      ? (planSel?.precio ?? 0)
      : (productoSel?.precio ?? 0) * cantidad;

  const preview = useMemo(() => {
    if (!total || cuotas < 2) return null;
    const montos = repartirMonto(total, cuotas);
    const fechas = fechasCuotas(cuotas, frecuencia);
    return montos.map((m, i) => ({ monto: m, fecha: fechas[i] }));
  }, [total, cuotas, frecuencia]);

  function cambiarTipo(t: TipoPlanPago) {
    setTipo(t);
    if (conceptoTocado) return;
    if (t === "membresia") {
      const p = planesMembresia.find((x) => x.id === planId) ?? planesMembresia[0];
      setConcepto(p ? "Membresía a plazos" : "");
    } else {
      const p = productos.find((x) => x.id === productoId) ?? productos[0];
      setConcepto(p ? p.nombre : "Producto a plazos");
    }
  }

  function seleccionarProducto(id: string) {
    setProductoId(id);
    if (conceptoTocado) return;
    const p = productos.find((x) => x.id === id);
    if (p) setConcepto(p.nombre);
  }

  function cambiarConcepto(v: string) {
    setConceptoTocado(true);
    setConcepto(v);
  }

  function crear() {
    if (tipo === "membresia" && !planId) {
      toastError("Selecciona un plan de membresía");
      return;
    }
    if (tipo === "producto") {
      if (!productoId) {
        toastError("Selecciona un producto");
        return;
      }
      if (productoSel && productoSel.stock < cantidad) {
        toastError("Stock insuficiente para esa cantidad");
        return;
      }
    }
    start(async () => {
      const r = await crearPlanPagoAction(
        tipo === "membresia"
          ? {
              miembro_id: miembroId,
              tipo,
              plan_membresia_id: planId,
              cuotas,
              concepto: concepto || undefined,
              frecuencia,
              metodo,
            }
          : {
              miembro_id: miembroId,
              tipo,
              producto_id: productoId,
              cantidad,
              cuotas,
              concepto: concepto || undefined,
              frecuencia,
              metodo,
            }
      );
      if (!r.ok) {
        toastError("No se pudo crear el plan", r.error);
        return;
      }
      // El plan ya existe en cualquiera de los dos casos de acá para abajo
      // — por eso ambos refrescan y cierran el formulario. Si la cuota 1
      // no se cobró, decirlo aparte en vez de mezclarlo con el éxito: el
      // plan quedó creado, pendiente de cobrar desde su propia tarjeta.
      if (r.cuota1Error) {
        warning(
          "Plan creado, pero la cuota 1 no se cobró",
          `${r.cuota1Error} Cóbrala desde la tarjeta del plan.`
        );
      } else {
        success("Plan creado y cuota 1 cobrada");
        if (r.reciboError) {
          warning("El recibo no se pudo enviar por correo", r.reciboError);
        }
      }
      router.refresh();
      onDone();
    });
  }

  const labelClass =
    "mb-2 block font-mono text-etiqueta uppercase text-text-secondary";
  const inputClass =
    "h-11 w-full rounded border border-border bg-bg px-3 text-sm text-text-primary focus:outline-none focus:border-brand-green";

  return (
    <div className="space-y-4 border border-border bg-bg p-5">
      {/* Tipo de plan: chip seleccionado en fondo lleno + ácido */}
      <div className="grid grid-cols-2 gap-2">
        {(["membresia", "producto"] as const).map((t) => {
          const active = tipo === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => cambiarTipo(t)}
              aria-pressed={active}
              className={`inline-flex h-11 items-center justify-center border px-3 text-sm font-medium transition-colors ${
                active
                  ? "border-brand-green bg-surface-hover text-brand-green"
                  : "border-border text-text-secondary hover:border-text-secondary hover:text-text-primary"
              }`}
            >
              {t === "membresia" ? "Membresía" : "Producto"}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {tipo === "membresia" ? (
          <div>
            <label className={labelClass} htmlFor="plan_membresia">
              Plan de membresía
            </label>
            <select
              id="plan_membresia"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className={inputClass}
            >
              {planesMembresia.length === 0 && (
                <option value="">Sin planes de membresía</option>
              )}
              {planesMembresia.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — {money(p.precio)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label className={labelClass} htmlFor="producto">
                Producto
              </label>
              <select
                id="producto"
                value={productoId}
                onChange={(e) => seleccionarProducto(e.target.value)}
                className={inputClass}
              >
                {productos.length === 0 && (
                  <option value="">Sin productos en inventario</option>
                )}
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — {money(p.precio)} (stock {p.stock})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="cantidad">
                Cantidad
              </label>
              <input
                id="cantidad"
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(1, Number(e.target.value)))}
                className={inputClass}
              />
            </div>
          </>
        )}

        <div>
          <span className={labelClass}>Monto total</span>
          <p
            className={`${inputClass} flex items-center font-mono tabular-nums text-text-secondary`}
          >
            {money(total)}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Calculado del precio {tipo === "membresia" ? "del plan" : "del producto × cantidad"} — no se puede editar.
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="cuotas">
            Número de cuotas
          </label>
          <select
            id="cuotas"
            value={cuotas}
            onChange={(e) => setCuotas(Number(e.target.value))}
            className={inputClass}
          >
            {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                {n} cuotas
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="frecuencia">
            Frecuencia
          </label>
          <select
            id="frecuencia"
            value={frecuencia}
            onChange={(e) => setFrecuencia(e.target.value as FrecuenciaCuota)}
            className={inputClass}
          >
            <option value="semanal">Semanal (cada 7 días)</option>
            <option value="quincenal">Quincenal (cada 15 días)</option>
            <option value="mensual">Mensual (cada 30 días)</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="concepto">
            Concepto
          </label>
          <input
            id="concepto"
            type="text"
            value={concepto}
            onChange={(e) => cambiarConcepto(e.target.value)}
            placeholder={tipo === "membresia" ? "Membresía a plazos" : "Producto"}
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Método de pago de la cuota 1</Label>
        <div className="grid grid-cols-3 gap-2">
          {METODOS.map((m) => {
            const active = metodo === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMetodo(m.value)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-11 items-center justify-center border px-2 text-sm font-medium transition-colors",
                  active
                    ? "border-brand-green bg-surface-hover text-brand-green"
                    : "border-border bg-bg text-text-secondary hover:border-text-secondary hover:text-text-primary"
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {tipo === "producto" && (
        <p className="text-sm text-text-muted">
          El producto se descuenta del inventario al crear el plan (el miembro se
          lo lleva hoy).
        </p>
      )}

      {preview && (
        <div className="border border-border bg-surface px-4 py-3">
          <p className="text-[15px] leading-5 text-text-primary">
            Cuota 1 de{" "}
            <span className="font-mono text-dato">{money(preview[0].monto)}</span>{" "}
            se cobra ahora, al crear el plan.
          </p>
          <p className="mt-1 text-[15px] leading-5 text-text-primary">
            Las siguientes {cuotas - 1} quedan pendientes
            {preview[0].monto !== preview[cuotas - 1].monto ? (
              <>
                {" "}
                (última{" "}
                <span className="font-mono text-dato">
                  {money(preview[cuotas - 1].monto)}
                </span>
                )
              </>
            ) : (
              <>
                {" "}
                de{" "}
                <span className="font-mono text-dato">{money(preview[1]?.monto ?? preview[0].monto)}</span>
              </>
            )}
            .
          </p>
          <p className="mt-1 text-sm text-text-muted">
            Vencen:{" "}
            <span className="font-mono">
              {preview.map((c) => fechaCorta(c.fecha)).join(" / ")}
            </span>
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="button" loading={pending} onClick={crear}>
          Crear plan y cobrar cuota 1
        </Button>
      </div>
    </div>
  );
}
