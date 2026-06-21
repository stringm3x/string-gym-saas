"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuBan } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { anularPagoAction } from "@/app/(tenant)/[slug]/caja/actions";

interface AnularPagoButtonProps {
  pagoId: string;
}

export function AnularPagoButton({ pagoId }: AnularPagoButtonProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleAnular() {
    startTransition(async () => {
      const result = await anularPagoAction(pagoId);
      if (!result.ok) {
        toastError("Error", result.error ?? "No se pudo anular el pago.");
        return;
      }
      success("Pago anulado");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<LuBan className="h-4 w-4" />}
        onClick={() => setOpen(true)}
        className="text-text-secondary hover:text-danger"
      >
        Anular pago
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Anular pago">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            ¿Anular este pago? Dejará de contar en los totales de caja y su
            recibo público quedará invalidado. Esta acción no se puede deshacer.
          </p>
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
              variant="danger"
              onClick={handleAnular}
              loading={isPending}
            >
              Anular pago
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
