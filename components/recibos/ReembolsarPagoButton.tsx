"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuUndo2 } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatMoneda } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { reembolsarPagoAction } from "@/app/(tenant)/[slug]/caja/actions";
import type { TipoDevolucion } from "@/lib/queries/reembolsos.queries";

const TIPOS_BASE: { value: TipoDevolucion; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
];

interface ReembolsarPagoButtonProps {
  pagoId: string;
  monto: number;
  /** La nota de crédito solo aplica si el pago tiene miembro. */
  tieneMiembro: boolean;
}

export function ReembolsarPagoButton({
  pagoId,
  monto,
  tieneMiembro,
}: ReembolsarPagoButtonProps) {
  const TIPOS = tieneMiembro
    ? [
        ...TIPOS_BASE,
        { value: "nota_credito" as TipoDevolucion, label: "Nota de crédito" },
      ]
    : TIPOS_BASE;
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoDevolucion>("efectivo");
  const [motivo, setMotivo] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleReembolsar() {
    startTransition(async () => {
      const r = await reembolsarPagoAction(pagoId, tipo, motivo);
      if (!r.ok) {
        toastError("Error", r.error ?? "No se pudo reembolsar el pago.");
        return;
      }
      success("Reembolso registrado");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<LuUndo2 className="h-4 w-4" />}
        onClick={() => setOpen(true)}
        className="text-text-secondary hover:text-warning"
      >
        Reembolsar
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reembolsar pago"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {tipo === "nota_credito" ? "Se emitirá " : "Se devolverá "}
            <span className="font-semibold text-text-primary">
              {formatMoneda(monto)}
            </span>
            {tipo === "nota_credito"
              ? " como saldo a favor del miembro."
              : "."}{" "}
            El pago dejará de contar como ingreso y, si era un producto, se
            restaura el stock. La vigencia de membresía no se ajusta
            automáticamente.
          </p>

          <div className="space-y-1.5">
            <span className="block text-xs font-mono uppercase tracking-widest text-text-muted">
              Método de devolución
            </span>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map((op) => (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setTipo(op.value)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                    tipo === op.value
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "border-border bg-surface text-text-secondary hover:text-text-primary"
                  )}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-mono uppercase tracking-widest text-text-muted">
              Motivo (opcional)
            </span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Ej. cambió de opinión, cargo duplicado…"
              className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleReembolsar}
              loading={isPending}
            >
              Registrar reembolso
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
