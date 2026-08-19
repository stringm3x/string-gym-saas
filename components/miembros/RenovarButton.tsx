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
  // Ciclos de facturación fijos (17→17, 20→20…): ajusta las fechas sin
  // soltar el plan elegido.
  const [fechasPersonalizadas, setFechasPersonalizadas] = useState(false);
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFin, setPeriodoFin] = useState("");

  if (planes.length === 0) return null;

  const plan = planes.find((p) => p.id === planId) ?? null;
  const rango = plan
    ? calcularRangoPorDias(plan.dias_duracion, fechaVencimiento)
    : null;

  function activarFechasPersonalizadas() {
    if (rango) {
      setPeriodoInicio(rango.periodo_inicio);
      setPeriodoFin(rango.periodo_fin);
    }
    setFechasPersonalizadas(true);
  }

  function renovar() {
    if (!planId) {
      toastError("Falta el plan", "Elige un plan para renovar.");
      return;
    }
    if (fechasPersonalizadas && (!periodoInicio || !periodoFin)) {
      toastError("Faltan fechas", "Indica inicio y fin de la vigencia.");
      return;
    }
    startTransition(async () => {
      const r = await renovarMiembroAction(
        miembroId,
        planId,
        metodo,
        fechasPersonalizadas ? periodoInicio : undefined,
        fechasPersonalizadas ? periodoFin : undefined
      );
      if (!r.ok) {
        toastError("No se pudo renovar", r.error ?? "Inténtalo de nuevo");
        return;
      }
      success("Membresía renovada");
      setOpen(false);
      setFechasPersonalizadas(false);
      if (r.pagoId) router.push(`/${slug}/recibos/${r.pagoId}`);
      else router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        leftIcon={<LuRefreshCw className="h-4 w-4" />}
        onClick={() => setOpen(true)}
        disabled={disabled}
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
              onChange={(e) => {
                setPlanId(e.target.value);
                setFechasPersonalizadas(false);
              }}
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

              {fechasPersonalizadas ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label>
                    <span className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">
                      Inicio
                    </span>
                    <input
                      type="date"
                      value={periodoInicio}
                      onChange={(e) => setPeriodoInicio(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text-primary focus:border-brand-green focus:outline-none"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-[10px] uppercase tracking-widest text-text-muted">
                      Fin
                    </span>
                    <input
                      type="date"
                      value={periodoFin}
                      min={periodoInicio || undefined}
                      onChange={(e) => setPeriodoFin(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text-primary focus:border-brand-green focus:outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setFechasPersonalizadas(false)}
                    className="col-span-2 text-left text-xs text-text-secondary underline underline-offset-2 hover:text-text-primary"
                  >
                    Usar la vigencia del plan
                  </button>
                </div>
              ) : (
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-text-secondary">Nueva vigencia hasta</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">
                      {formatearFechaMX(rango.periodo_fin)}
                    </span>
                    <button
                      type="button"
                      onClick={activarFechasPersonalizadas}
                      className="text-xs text-brand-green underline underline-offset-2 hover:opacity-80"
                    >
                      Personalizar
                    </button>
                  </div>
                </div>
              )}
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
