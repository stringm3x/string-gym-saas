"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { crearPlanPagoAction } from "@/app/(tenant)/[slug]/miembros/[id]/creditos-actions";
import { repartirMonto, fechasCuotas, money } from "@/lib/utils/creditos-calc";
import type {
  FrecuenciaCuota,
  TipoPlanPago,
} from "@/lib/validations/creditos.schema";

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
  const { success, error: toastError } = useToast();
  const [pending, start] = useTransition();

  const [tipo, setTipo] = useState<TipoPlanPago>("membresia");
  const [planId, setPlanId] = useState(planesMembresia[0]?.id ?? "");
  const [productoId, setProductoId] = useState(productos[0]?.id ?? "");
  const [cantidad, setCantidad] = useState(1);
  const [total, setTotal] = useState<number>(planesMembresia[0]?.precio ?? 0);
  const [cuotas, setCuotas] = useState(3);
  const [frecuencia, setFrecuencia] = useState<FrecuenciaCuota>("quincenal");
  const [concepto, setConcepto] = useState("Membresía a plazos");

  const productoSel = productos.find((p) => p.id === productoId) ?? null;

  const preview = useMemo(() => {
    if (!total || cuotas < 2) return null;
    const montos = repartirMonto(total, cuotas);
    const fechas = fechasCuotas(cuotas, frecuencia);
    return montos.map((m, i) => ({ monto: m, fecha: fechas[i] }));
  }, [total, cuotas, frecuencia]);

  function cambiarTipo(t: TipoPlanPago) {
    setTipo(t);
    if (t === "membresia") {
      const p = planesMembresia.find((x) => x.id === planId) ?? planesMembresia[0];
      setPlanId(p?.id ?? "");
      setTotal(p?.precio ?? 0);
      setConcepto("Membresía a plazos");
    } else {
      const p = productos.find((x) => x.id === productoId) ?? productos[0];
      setProductoId(p?.id ?? "");
      setCantidad(1);
      setTotal(p?.precio ?? 0);
      setConcepto(p ? p.nombre : "Producto a plazos");
    }
  }

  function seleccionarPlan(id: string) {
    setPlanId(id);
    const p = planesMembresia.find((x) => x.id === id);
    if (p) setTotal(p.precio);
  }

  function seleccionarProducto(id: string) {
    setProductoId(id);
    const p = productos.find((x) => x.id === id);
    if (p) {
      setTotal(p.precio * cantidad);
      setConcepto(p.nombre);
    }
  }

  function cambiarCantidad(n: number) {
    const c = Math.max(1, n);
    setCantidad(c);
    if (productoSel) setTotal(productoSel.precio * c);
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
              total,
              cuotas,
              concepto: concepto || undefined,
              frecuencia,
            }
          : {
              miembro_id: miembroId,
              tipo,
              producto_id: productoId,
              cantidad,
              total,
              cuotas,
              concepto: concepto || undefined,
              frecuencia,
            }
      );
      if (!r.ok) {
        toastError("No se pudo crear el plan", r.error);
        return;
      }
      success("Plan de pagos creado");
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
              onChange={(e) => seleccionarPlan(e.target.value)}
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
                onChange={(e) => cambiarCantidad(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </>
        )}

        <div>
          <label className={labelClass} htmlFor="total">
            Monto total
          </label>
          <input
            id="total"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={total}
            onChange={(e) => setTotal(Number(e.target.value))}
            className={`${inputClass} font-mono tabular-nums`}
          />
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
            onChange={(e) => setConcepto(e.target.value)}
            placeholder={tipo === "membresia" ? "Membresía a plazos" : "Producto"}
            className={inputClass}
          />
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
            {cuotas} cuotas de{" "}
            <span className="font-mono text-dato">{money(preview[0].monto)}</span>
            {preview[0].monto !== preview[cuotas - 1].monto && (
              <>
                {" "}
                (última{" "}
                <span className="font-mono text-dato">
                  {money(preview[cuotas - 1].monto)}
                </span>
                )
              </>
            )}
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
          Crear plan de pagos
        </Button>
      </div>
    </div>
  );
}
