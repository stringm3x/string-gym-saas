"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";
import { pagarCuotaAction } from "@/app/(tenant)/[slug]/miembros/[id]/creditos-actions";
import { money } from "@/lib/utils/creditos-calc";

const METODOS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
] as const;

type Metodo = (typeof METODOS)[number]["value"];

export function CobroCuotaModal({
  open,
  onClose,
  cuotaId,
  numeroCuota,
  totalCuotas,
  monto,
  miembroNombre,
}: {
  open: boolean;
  onClose: () => void;
  cuotaId: string;
  numeroCuota: number;
  totalCuotas?: number;
  monto: number;
  miembroNombre: string;
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [metodo, setMetodo] = useState<Metodo>("efectivo");
  const [pending, start] = useTransition();

  function confirmar() {
    start(async () => {
      const r = await pagarCuotaAction(cuotaId, metodo);
      if (!r.ok) {
        toastError("No se pudo registrar el pago", r.error);
        return;
      }
      success(
        r.planCompletado
          ? "Cuota pagada — plan completado"
          : "Pago de cuota registrado"
      );
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar pago de cuota"
      description={
        totalCuotas
          ? `Cuota ${numeroCuota} de ${totalCuotas}`
          : `Cuota ${numeroCuota}`
      }
      size="sm"
    >
      <div className="space-y-4">
        <dl className="divide-y divide-border border border-border bg-bg">
          <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-text-secondary">Miembro</dt>
            <dd className="truncate text-text-primary">{miembroNombre}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-text-secondary">Monto</dt>
            <dd className="font-mono text-dato font-bold tabular-nums text-text-primary">
              {money(monto)}
            </dd>
          </div>
        </dl>

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

        <Button
          type="button"
          loading={pending}
          onClick={confirmar}
          size="lg"
          className="w-full"
        >
          Confirmar pago · {money(monto)}
        </Button>
      </div>
    </Modal>
  );
}
