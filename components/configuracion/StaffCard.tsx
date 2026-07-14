"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatFechaHora } from "@/lib/utils/format";
import {
  resendInviteAction,
  cancelInviteAction,
  deactivateStaffAction,
  reactivateStaffAction,
  deleteStaffAction,
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
    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-green/10 font-display text-lg text-brand-green">
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
          <p className="text-xs text-text-muted">Dueño del gym</p>
        ) : staff.estado === "activo" && staff.ultima_sesion_at ? (
          <p className="text-xs text-text-muted">
            Última sesión: {formatFechaHora(staff.ultima_sesion_at)}
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
            <ActionLink
              danger
              disabled={isPending}
              onClick={() =>
                run(() => deactivateStaffAction(staff.id), "Miembro desactivado")
              }
            >
              Desactivar
            </ActionLink>
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
    </div>
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
      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
        danger
          ? "text-text-secondary hover:bg-danger/10 hover:text-danger"
          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}
