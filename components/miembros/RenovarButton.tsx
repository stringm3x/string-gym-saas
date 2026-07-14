"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuRefreshCw } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatMoneda } from "@/lib/utils/format";
import { formatearFechaMX } from "@/lib/utils/dates";
import { calcularRangoPorDias } from "@/lib/utils/membresia-rango";
import { cn } from "@/lib/utils/cn";
import { renovarMiembroAction } from "@/app/(tenant)/[slug]/miembros/[id]/renovar-actions";
import type { PlanMembresia } from "@/lib/queries/planes.queries";

type Metodo = "efectivo" | "tarjeta" | "transferencia";
const METODOS: { value: Metodo; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
];

interface RenovarButtonProps {
  slug: string;
  miembroId: string;
  planActualId: string | null;
  fechaVencimiento: string | null;
  planes: PlanMembresia[];
  disabled?: boolean;
}

export function RenovarButton({
  slug,
  miembroId,
  planActualId,
  fechaVencimiento,
  planes,
  disabled = false,
}: RenovarButtonProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState(planActualId ?? planes[0]?.id ?? "");
  const [metodo, setMetodo] = useState<Metodo>("efectivo");
  const [isPending, startTransition] = useTransition();

  if (planes.length === 0) return null;

  const plan = planes.find((p) => p.id === planId) ?? null;
  const rango = plan
    ? calcularRangoPorDias(plan.dias_duracion, fechaVencimiento)
    : null;

  function renovar() {
    if (!planId) {
      toastError("Falta el plan", "Elige un plan para renovar.");
      return;
    }
    startTransition(async () => {
      const r = await renovarMiembroAction(miembroId, planId, metodo);
      if (!r.ok) {
        toastError("No se pudo renovar", r.error ?? "Inténtalo de nuevo");
        return;
      }
      success("Membresía renovada");
      setOpen(false);
      if (r.pagoId) router.push(`/${slug}/recibos/${r.pagoId}`);
      else router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<LuRefreshCw className="h-4 w-4" />}
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="text-text-secondary hover:text-brand-green"
      >
        Renovar
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Renovar membresía">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="block text-xs font-mono uppercase tracking-widest text-text-muted">
              Plan
            </span>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full cursor-pointer appearance-none rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:border-brand-green focus:outline-none"
            >
              {planes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — {formatMoneda(p.precio)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-mono uppercase tracking-widest text-text-muted">
              Método de pago
            </span>
            <div className="grid grid-cols-3 gap-2">
              {METODOS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMetodo(m.value)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                    metodo === m.value
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "border-border bg-surface text-text-secondary hover:text-text-primary"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {plan && rango && (
            <div className="rounded-lg border border-border bg-bg p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">A cobrar</span>
                <span className="font-mono font-semibold text-brand-green">
                  {formatMoneda(plan.precio)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-text-secondary">Nueva vigencia hasta</span>
                <span className="font-medium text-text-primary">
                  {formatearFechaMX(rango.periodo_fin)}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={renovar} loading={isPending}>
              Cobrar renovación
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
