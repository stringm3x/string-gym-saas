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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            Equipo de {gymNombre}
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            Invita a tu equipo (recepción, entrenadores, gerentes) y define con
            qué rol entra cada quien.
          </p>
        </div>
        <Button
          leftIcon={<LuUserPlus className="h-4 w-4" />}
          onClick={() => setInviteOpen(true)}
        >
          Invitar empleado
        </Button>
      </div>

      <ul className="divide-y divide-border border border-border bg-surface">
        {ordenado.map((s) => (
          <StaffCard key={s.id} staff={s} />
        ))}
      </ul>

      <section className="border-t border-border pt-6">
        <h3 className="text-base font-semibold text-text-primary">
          PIN de caja
        </h3>
        <label className="mt-4 flex cursor-pointer items-start gap-3 border border-border p-4">
          <input
            type="checkbox"
            checked={cajaCheckinPin}
            onChange={(e) => toggleCheckin(e.target.checked)}
            disabled={isPending}
            className="mt-0.5 h-4 w-4 rounded border-border accent-brand-green"
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
              <LuKeyRound className="h-4 w-4" aria-hidden="true" />
              Pedir PIN al abrir/cerrar turno de caja
            </span>
            <span className="mt-1 block text-xs text-text-secondary">
              Útil si varios empleados comparten la misma tablet o computadora
              de recepción: en vez de confiar en qué sesión esté activa en el
              navegador, cada quien confirma su identidad con su PIN de 4
              dígitos. Asígnale un PIN a cada empleado con el botón
              &quot;PIN&quot; de su fila.
            </span>
          </span>
        </label>
      </section>

      <InviteStaffModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
