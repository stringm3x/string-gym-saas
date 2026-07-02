"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { crearPlanPagoAction } from "@/app/(tenant)/[slug]/miembros/[id]/creditos-actions";
import { repartirMonto, fechasCuotas, money } from "@/lib/utils/creditos-calc";
import type { FrecuenciaCuota } from "@/lib/validations/creditos.schema";

interface PlanMembresiaOpt {
  id: string;
  nombre: string;
  precio: number;
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
  onDone,
}: {
  miembroId: string;
  planesMembresia: PlanMembresiaOpt[];
  onDone: () => void;
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [pending, start] = useTransition();

  const [planId, setPlanId] = useState(planesMembresia[0]?.id ?? "");
  const [total, setTotal] = useState<number>(planesMembresia[0]?.precio ?? 0);
  const [cuotas, setCuotas] = useState(3);
  const [frecuencia, setFrecuencia] = useState<FrecuenciaCuota>("quincenal");
  const [concepto, setConcepto] = useState("Membresía a plazos");

  const preview = useMemo(() => {
    if (!total || cuotas < 2) return null;
    const montos = repartirMonto(total, cuotas);
    const fechas = fechasCuotas(cuotas, frecuencia);
    return montos.map((m, i) => ({ monto: m, fecha: fechas[i] }));
  }, [total, cuotas, frecuencia]);

  function seleccionarPlan(id: string) {
    setPlanId(id);
    const p = planesMembresia.find((x) => x.id === id);
    if (p) setTotal(p.precio);
  }

  function crear() {
    if (!planId) {
      toastError("Selecciona un plan de membresía");
      return;
    }
    start(async () => {
      const r = await crearPlanPagoAction({
        miembro_id: miembroId,
        plan_membresia_id: planId,
        total,
        cuotas,
        concepto: concepto || undefined,
        frecuencia,
      });
      if (!r.ok) {
        toastError("No se pudo crear el plan", r.error);
        return;
      }
      success("Plan de pagos creado");
      router.refresh();
      onDone();
    });
  }

  const labelClass = "block text-xs font-medium text-text-secondary mb-1";
  const inputClass =
    "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-green";

  return (
    <div className="space-y-4 rounded-xl border border-border bg-bg p-4">
      <div className="grid gap-4 sm:grid-cols-2">
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

        <div>
          <label className={labelClass} htmlFor="total">
            Monto total
          </label>
          <input
            id="total"
            type="number"
            min={0}
            step="0.01"
            value={total}
            onChange={(e) => setTotal(Number(e.target.value))}
            className={inputClass}
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
            placeholder="Membresía a plazos"
            className={inputClass}
          />
        </div>
      </div>

      {preview && (
        <div className="rounded-lg border border-brand-green/20 bg-brand-green/5 px-4 py-3">
          <p className="text-xs font-medium text-brand-green">
            {cuotas} cuotas de {money(preview[0].monto)}
            {preview[0].monto !== preview[cuotas - 1].monto &&
              ` (última ${money(preview[cuotas - 1].monto)})`}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Vencen: {preview.map((c) => fechaCorta(c.fecha)).join(" / ")}
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={pending || !planId}
          onClick={crear}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear plan de pagos"}
        </button>
      </div>
    </div>
  );
}
