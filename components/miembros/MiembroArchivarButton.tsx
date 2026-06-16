"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuArchive } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { archivarMiembroAction } from "@/app/(tenant)/[slug]/miembros/actions";

interface MiembroArchivarButtonProps {
  miembroId: string;
  miembroNombre: string;
}

export function MiembroArchivarButton({
  miembroId,
  miembroNombre,
}: MiembroArchivarButtonProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleArchivar() {
    startTransition(async () => {
      const result = await archivarMiembroAction(miembroId);
      if (!result.ok) {
        toastError("Error", result.error ?? "No se pudo archivar.");
        return;
      }
      success("Miembro archivado");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        leftIcon={<LuArchive className="h-4 w-4" />}
        onClick={() => setOpen(true)}
      >
        Archivar
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Archivar miembro">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            ¿Archivar a{" "}
            <span className="font-medium text-text-primary">
              {miembroNombre}
            </span>
            ? Sus datos y pagos se conservarán, pero no aparecerá en listados
            activos. Podrás restaurarlo después.
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
              onClick={handleArchivar}
              loading={isPending}
            >
              Archivar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
