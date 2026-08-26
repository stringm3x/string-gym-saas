"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuUserPlus, LuKeyRound } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { toggleCajaCheckinPinAction } from "@/app/(tenant)/[slug]/configuracion/staff/actions";
import { StaffCard } from "./StaffCard";
import { InviteStaffModal } from "./InviteStaffModal";
import type { Staff } from "@/lib/types/staff";

interface StaffManagerProps {
  staff: Staff[];
  gymNombre: string;
  cajaCheckinPin: boolean;
}

export function StaffManager({
  staff,
  gymNombre,
  cajaCheckinPin,
}: StaffManagerProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Owner primero, luego por fecha de creación.
  const ordenado = [...staff].sort((a, b) => {
    if (a.rol === "owner" && b.rol !== "owner") return -1;
    if (b.rol === "owner" && a.rol !== "owner") return 1;
    return a.created_at.localeCompare(b.created_at);
  });

  function toggleCheckin(activar: boolean) {
    startTransition(async () => {
      const r = await toggleCajaCheckinPinAction(activar);
      if (!r.ok) {
        toastError("No se pudo actualizar", r.error);
        return;
      }
      success(activar ? "Check-in por PIN activado" : "Check-in por PIN desactivado");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Equipo de {gymNombre}
          </h3>
          <p className="text-xs text-text-secondary">
            Invita a tu equipo (recepción, entrenadores, gerentes) para que
            ayuden a operar tu gimnasio.
          </p>
        </div>
        <Button
          leftIcon={<LuUserPlus className="h-4 w-4" />}
          onClick={() => setInviteOpen(true)}
          size="sm"
        >
          Invitar empleado
        </Button>
      </div>

      <div className="space-y-2">
        {ordenado.map((s) => (
          <StaffCard key={s.id} staff={s} />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={cajaCheckinPin}
            onChange={(e) => toggleCheckin(e.target.checked)}
            disabled={isPending}
            className="mt-0.5 h-4 w-4 rounded border-border accent-brand-green"
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
              <LuKeyRound className="h-3.5 w-3.5" />
              Pedir PIN al abrir/cerrar turno de caja
            </span>
            <span className="mt-0.5 block text-xs text-text-secondary">
              Útil si varios empleados comparten la misma tablet/computadora
              de recepción: en vez de confiar en qué sesión esté activa en el
              navegador, cada quien confirma su identidad con su PIN de 4
              dígitos. Asígnale un PIN a cada empleado con el botón
              &quot;PIN&quot; de su fila.
            </span>
          </span>
        </label>
      </div>

      <InviteStaffModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
