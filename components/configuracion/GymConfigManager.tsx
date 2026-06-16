"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  updateGymConfigAction,
  type GymConfigFormState,
} from "@/app/(tenant)/[slug]/configuracion/gym/actions";
import type { GymFull } from "@/lib/queries/gyms.queries";

const initialState: GymConfigFormState = {
  ok: false,
  error: null,
  fieldErrors: {},
};

interface GymConfigManagerProps {
  gym: GymFull;
}

export function GymConfigManager({ gym }: GymConfigManagerProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [state, formAction, isPending] = useActionState(
    updateGymConfigAction,
    initialState
  );

  useEffect(() => {
    if (state.ok) {
      success("Configuración guardada");
      router.refresh();
    }
  }, [state.ok]);

  useEffect(() => {
    if (state.error && Object.keys(state.fieldErrors).length === 0) {
      toastError("Error", state.error);
    }
  }, [state.error]);

  return (
    <form action={formAction} className="space-y-4 max-w-lg">
      <Input
        label="Nombre del gimnasio"
        name="nombre"
        required
        defaultValue={gym.nombre}
        placeholder="Mi Gym"
        error={state.fieldErrors.nombre}
        autoFocus
      />

      <Input
        label="Teléfono"
        name="telefono"
        defaultValue={gym.telefono ?? ""}
        placeholder="55 1234 5678"
        description="Aparece en los recibos de pago"
        error={state.fieldErrors.telefono}
      />

      <Input
        label="Dirección"
        name="direccion"
        defaultValue={gym.direccion ?? ""}
        placeholder="Av. Ejemplo 123, Col. Centro"
        description="Aparece en los recibos de pago"
        error={state.fieldErrors.direccion}
      />

      <Input
        label="RFC"
        name="rfc"
        defaultValue={gym.rfc ?? ""}
        placeholder="GYM123456789"
        description="Registro Federal de Contribuyentes"
        error={state.fieldErrors.rfc}
      />

      {state.error && Object.keys(state.fieldErrors).length === 0 && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}

      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" loading={isPending}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
