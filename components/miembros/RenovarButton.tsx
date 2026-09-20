"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuRefreshCw } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
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
  const { success, error: toastError, warning } = useToast();
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
      if (r.reciboError) {
        warning("El recibo no se pudo enviar por correo", r.reciboError);
      }
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
          <div className="space-y-2">
            <Label htmlFor="renovar-plan">Plan</Label>
            <select
              id="renovar-plan"
              value={planId}
              onChange={(e) => {
                setPlanId(e.target.value);
                setFechasPersonalizadas(false);
              }}
              className="h-11 w-full cursor-pointer rounded border border-border bg-bg px-3 text-sm text-text-primary focus:border-brand-green focus:outline-none"
            >
              {planes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — {formatMoneda(p.precio)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Método</Label>
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

          {plan && rango && (
            <div className="flex flex-col gap-3 border border-border bg-bg p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-text-secondary">A cobrar</span>
                <span className="font-mono text-dato font-bold tabular-nums text-text-primary">
                  {formatMoneda(plan.precio)}
                </span>
              </div>

              {fechasPersonalizadas ? (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Inicio"
                    type="date"
                    value={periodoInicio}
                    onChange={(e) => setPeriodoInicio(e.target.value)}
                  />
                  <Input
                    label="Fin"
                    type="date"
                    value={periodoFin}
                    min={periodoInicio || undefined}
                    onChange={(e) => setPeriodoFin(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setFechasPersonalizadas(false)}
                    className="col-span-2 inline-flex h-9 items-center self-start text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
                  >
                    Usar la vigencia del plan
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-text-secondary">Nueva vigencia hasta</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-dato tabular-nums text-text-primary">
                      {formatearFechaMX(rango.periodo_fin)}
                    </span>
                    <button
                      type="button"
                      onClick={activarFechasPersonalizadas}
                      className="inline-flex h-9 items-center text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
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
              variant="secondary"
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
