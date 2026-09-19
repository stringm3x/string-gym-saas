"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  inviteStaffAction,
  type StaffActionState,
} from "@/app/(tenant)/[slug]/configuracion/staff/actions";

const initialState: StaffActionState = {
  ok: false,
  error: null,
  fieldErrors: {},
};

interface InviteStaffModalProps {
  open: boolean;
  onClose: () => void;
}

export function InviteStaffModal({ open, onClose }: InviteStaffModalProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [state, formAction, isPending] = useActionState(
    inviteStaffAction,
    initialState
  );

  useEffect(() => {
    if (state.ok) {
      success("Invitación enviada");
      router.refresh();
      onClose();
    } else if (state.error && Object.keys(state.fieldErrors).length === 0) {
      toastError("No se pudo invitar", state.error);
    }
  }, [state]);

  return (
    <Modal open={open} onClose={onClose} title="Invitar al equipo">
      <form action={formAction} className="space-y-4">
        <Input
          label="Correo"
          name="email"
          type="email"
          required
          placeholder="recepcionista@correo.com"
          error={state.fieldErrors.email}
          autoFocus
        />

        <Input
          label="Nombre completo"
          name="nombre"
          required
          placeholder="Ej. Ana López"
          error={state.fieldErrors.nombre}
        />

        <div className="space-y-2">
          <Label htmlFor="invite-rol">Rol</Label>
          <select
            id="invite-rol"
            name="rol"
            defaultValue="receptionist"
            className="h-11 w-full cursor-pointer rounded border border-border bg-bg px-3 text-sm text-text-primary focus:border-brand-green focus:outline-none"
          >
            <option value="receptionist">
              Recepcionista — caja, socios, check-in
            </option>
            <option value="entrenador">
              Entrenador — clases, socios y nutrición (sin caja)
            </option>
            <option value="gerente">
              Gerente — todo excepto configurar planes
            </option>
          </select>
        </div>

        <p className="border border-border bg-bg px-4 py-3 text-xs text-text-muted">
          Le mandaremos un correo con instrucciones para crear su contraseña y
          acceder al sistema. La invitación expira en 7 días.
        </p>

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            Enviar invitación
          </Button>
        </div>
      </form>
    </Modal>
  );
}
