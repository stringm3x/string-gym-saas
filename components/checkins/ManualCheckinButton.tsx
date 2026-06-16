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
  const { success, error } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await registerCheckinAction(miembroId);
      if (result.ok) {
        success("Check-in registrado", miembroNombre);
      } else {
        error("No se pudo registrar", result.error ?? "Inténtalo de nuevo");
      }
    });
  }

  return (
    <Button
      variant="secondary"
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
