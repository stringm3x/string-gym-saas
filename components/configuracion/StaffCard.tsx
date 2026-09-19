"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatFechaHora } from "@/lib/utils/format";
import {
  resendInviteAction,
  cancelInviteAction,
  deactivateStaffAction,
  reactivateStaffAction,
  deleteStaffAction,
  setStaffPinAction,
  clearStaffPinAction,
} from "@/app/(tenant)/[slug]/configuracion/staff/actions";
import type { Staff, StaffEstado, StaffRol } from "@/lib/types/staff";

const estadoBadge: Record<StaffEstado, { variant: BadgeVariant; label: string }> = {
  invitado: { variant: "warning", label: "Invitado" },
  activo: { variant: "success", label: "Activo" },
  desactivado: { variant: "neutral", label: "Desactivado" },
};

const ROL_LABEL: Record<StaffRol, string> = {
  owner: "Dueño",
  gerente: "Gerente",
  entrenador: "Entrenador",
  receptionist: "Recepcionista",
};

interface StaffCardProps {
  staff: Staff;
}

export function StaffCard({ staff }: StaffCardProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [pinOpen, setPinOpen] = useState(false);

  const isOwner = staff.rol === "owner";
  const inicial = staff.nombre.trim().charAt(0).toUpperCase() || "?";
  const badge = estadoBadge[staff.estado];

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toastError("Error", result.error ?? "No se pudo completar la acción.");
        return;
      }
      success(okMsg);
      router.refresh();
    });
  }

  function confirmDelete() {
    if (
      window.confirm(
        `¿Eliminar permanentemente a ${staff.nombre} (${staff.email})? ` +
          "Se borrará su cuenta y no podrá entrar. Esta acción no se puede deshacer."
      )
    ) {
      run(() => deleteStaffAction(staff.id), "Miembro eliminado");
    }
  }

  return (
    <li className="flex items-center gap-4 px-5 py-4">
      <div
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-green/15 font-mono text-base font-bold text-brand-green"
      >
        {inicial}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            {staff.nombre}
          </span>
          <Badge variant={isOwner ? "info" : "neutral"}>
            {ROL_LABEL[staff.rol] ?? "Recepcionista"}
          </Badge>
          {!isOwner && <Badge variant={badge.variant}>{badge.label}</Badge>}
        </div>
        <p className="truncate text-xs text-text-secondary">{staff.email}</p>
        {isOwner ? (
          <p className="text-xs text-text-muted">Dueño del gimnasio</p>
        ) : staff.estado === "activo" && staff.ultima_sesion_at ? (
          <p className="text-xs text-text-muted">
            Última sesión:{" "}
            <span className="font-mono tabular-nums">
              {formatFechaHora(staff.ultima_sesion_at)}
            </span>
          </p>
        ) : null}
      </div>

      {!isOwner && (
        <div className="flex shrink-0 items-center gap-2">
          {staff.estado === "invitado" && (
            <>
              <ActionLink
                disabled={isPending}
                onClick={() =>
                  run(() => resendInviteAction(staff.id), "Invitación reenviada")
                }
              >
                Reenviar
              </ActionLink>
              <ActionLink
                danger
                disabled={isPending}
                onClick={() =>
                  run(() => cancelInviteAction(staff.id), "Invitación cancelada")
                }
              >
                Cancelar
              </ActionLink>
            </>
          )}

          {staff.estado === "activo" && (
            <>
              <ActionLink disabled={isPending} onClick={() => setPinOpen(true)}>
                PIN
              </ActionLink>
              <ActionLink
                danger
                disabled={isPending}
                onClick={() =>
                  run(() => deactivateStaffAction(staff.id), "Miembro desactivado")
                }
              >
                Desactivar
              </ActionLink>
            </>
          )}

          {staff.estado === "desactivado" && (
            <>
              <ActionLink
                disabled={isPending}
                onClick={() =>
                  run(() => reactivateStaffAction(staff.id), "Miembro reactivado")
                }
              >
                Reactivar
              </ActionLink>
              <ActionLink danger disabled={isPending} onClick={confirmDelete}>
                Eliminar
              </ActionLink>
            </>
          )}
        </div>
      )}

      {pinOpen && (
        <PinModal
          staffId={staff.id}
          staffNombre={staff.nombre}
          onClose={() => setPinOpen(false)}
        />
      )}
    </li>
  );
}

function PinModal({
  staffId,
  staffNombre,
  onClose,
}: {
  staffId: string;
  staffNombre: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [pin, setPin] = useState("");
  const [isPending, startTransition] = useTransition();

  function guardar() {
    if (!/^\d{4}$/.test(pin)) {
      toastError("PIN inválido", "Debe ser de 4 dígitos.");
      return;
    }
    startTransition(async () => {
      const r = await setStaffPinAction(staffId, pin);
      if (!r.ok) {
        toastError("No se pudo guardar", r.error);
        return;
      }
      success("PIN asignado");
      router.refresh();
      onClose();
    });
  }

  function quitar() {
    startTransition(async () => {
      const r = await clearStaffPinAction(staffId);
      if (!r.ok) {
        toastError("No se pudo quitar", r.error);
        return;
      }
      success("PIN eliminado");
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`PIN de ${staffNombre}`}
      description="4 dígitos. Lo usa para confirmar su identidad al abrir o cerrar un turno de caja, sin tener que iniciar sesión con su cuenta."
      size="sm"
    >
      <div className="space-y-4">
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="0000"
          aria-label="PIN de 4 dígitos"
          autoFocus
          className="w-full rounded border border-border bg-bg px-3 py-3 text-center font-mono text-2xl tabular-nums tracking-[0.5em] text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
        />
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={quitar}
            disabled={isPending}
            className="hover:text-danger"
          >
            Quitar PIN
          </Button>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="button" onClick={guardar} loading={isPending}>
              Guardar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ActionLink({
  children,
  onClick,
  danger = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 items-center px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "text-text-secondary hover:bg-surface-hover hover:text-danger"
          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}
