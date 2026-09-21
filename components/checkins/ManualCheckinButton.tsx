"use client";

import { useTransition } from "react";
import { LuScanLine } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { registerCheckinAction } from "@/app/(tenant)/[slug]/checkins/actions";

interface ManualCheckinButtonProps {
  miembroId: string;
  miembroNombre: string;
  disabled?: boolean;
  disabledTitle?: string;
}

export function ManualCheckinButton({
  miembroId,
  miembroNombre,
  disabled = false,
  disabledTitle,
}: ManualCheckinButtonProps) {
  const { success, warning, error } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await registerCheckinAction(miembroId);
      if (result.ok) {
        const estado = result.miembro?.estadoMembresia;
        if (estado === "vencido" || estado === "sin_membresia") {
          warning(
            "Check-in registrado, pero revisá la membresía",
            estado === "sin_membresia"
              ? `${miembroNombre} no tiene membresía registrada`
              : `${miembroNombre} tiene la membresía vencida`
          );
        } else {
          success("Check-in registrado", miembroNombre);
        }
      } else {
        error("No se pudo registrar", result.error ?? "Inténtalo de nuevo");
      }
    });
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      leftIcon={<LuScanLine className="h-4 w-4" />}
      onClick={handleClick}
      loading={isPending}
      disabled={disabled}
      title={disabled ? disabledTitle : undefined}
    >
      Registrar check-in
    </Button>
  );
}
