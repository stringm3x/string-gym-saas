"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
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
          ? "Cuota pagada — plan completado 🎉"
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
        <div className="rounded-lg border border-border bg-bg px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">Miembro</span>
            <span className="font-medium text-text-primary">
              {miembroNombre}
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-text-secondary">Monto</span>
            <span className="font-semibold text-brand-green">
              {money(monto)}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-text-secondary">
            Método de pago
          </span>
          <div className="grid grid-cols-3 gap-2">
            {METODOS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMetodo(m.value)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  metodo === m.value
                    ? "border-brand-green bg-brand-green/10 text-brand-green"
                    : "border-border text-text-secondary hover:text-text-primary"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={confirmar}
          className="w-full rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Registrando…" : "Confirmar pago"}
        </button>
      </div>
    </Modal>
  );
}
