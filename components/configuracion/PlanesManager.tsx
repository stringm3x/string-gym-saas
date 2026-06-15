"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { LuPencil, LuPlus, LuPackage } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { formatMoneda } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { PlanMembresia } from "@/lib/queries/planes.queries";
import {
  createPlanAction,
  updatePlanAction,
  togglePlanAction,
  type PlanFormState,
} from "@/app/(tenant)/[slug]/configuracion/planes/actions";

interface PlanesManagerProps {
  planes: PlanMembresia[];
}

const initial: PlanFormState = { ok: false, error: null, fieldErrors: {} };

export function PlanesManager({ planes }: PlanesManagerProps) {
  const [modal, setModal] = useState<
    { mode: "create" } | { mode: "edit"; plan: PlanMembresia } | null
  >(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {planes.length === 0
            ? "Sin planes definidos"
            : `${planes.length} ${planes.length === 1 ? "plan" : "planes"}`}
        </p>
        <Button
          leftIcon={<LuPlus className="h-4 w-4" />}
          onClick={() => setModal({ mode: "create" })}
        >
          Nuevo plan
        </Button>
      </div>

      {planes.length === 0 ? (
        <EmptyState
          icon={<LuPackage className="h-5 w-5" />}
          title="Aún no hay planes"
          description="Define los planes de membresía que ofreces (ej. Mensualidad, Trimestre) para cobrar más rápido."
          action={
            <Button
              leftIcon={<LuPlus className="h-4 w-4" />}
              onClick={() => setModal({ mode: "create" })}
            >
              Crear primer plan
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {planes.map((p) => (
            <PlanRow
              key={p.id}
              plan={p}
              onEdit={() => setModal({ mode: "edit", plan: p })}
            />
          ))}
        </ul>
      )}

      <PlanFormModal modal={modal} onClose={() => setModal(null)} />
    </div>
  );
}

function PlanRow({
  plan,
  onEdit,
}: {
  plan: PlanMembresia;
  onEdit: () => void;
}) {
  const { success, error } = useToast();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const r = await togglePlanAction(plan.id, !plan.activo);
      if (r.ok) {
        success(plan.activo ? "Plan archivado" : "Plan activado");
      } else {
        error("No se pudo actualizar", r.error);
      }
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-text-primary">
              {plan.nombre}
            </p>
            {!plan.activo && <Badge variant="neutral">Archivado</Badge>}
          </div>
          <p className="text-xs text-text-secondary">
            {plan.dias_duracion} {plan.dias_duracion === 1 ? "día" : "días"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-semibold text-text-primary tabular-nums">
          {formatMoneda(plan.precio)}
        </span>
        <button
          type="button"
          onClick={toggle}
          disabled={isPending}
          className={cn(
            "text-xs font-medium transition-colors duration-150",
            plan.activo
              ? "text-text-muted hover:text-text-secondary"
              : "text-brand-green hover:text-brand-green/80"
          )}
        >
          {plan.activo ? "Archivar" : "Activar"}
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          aria-label={`Editar ${plan.nombre}`}
        >
          <LuPencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}

function PlanFormModal({
  modal,
  onClose,
}: {
  modal: { mode: "create" } | { mode: "edit"; plan: PlanMembresia } | null;
  onClose: () => void;
}) {
  const { success } = useToast();

  const action =
    modal?.mode === "edit"
      ? updatePlanAction.bind(null, modal.plan.id)
      : createPlanAction;

  const [state, formAction, isPending] = useActionState(action, initial);

  useEffect(() => {
    if (state.ok) {
      success(modal?.mode === "edit" ? "Plan actualizado" : "Plan creado");
      onClose();
    }
  }, [state, modal, success, onClose]);

  if (!modal) return null;

  const plan = modal.mode === "edit" ? modal.plan : undefined;

  return (
    <Modal
      open={!!modal}
      onClose={onClose}
      title={modal.mode === "edit" ? "Editar plan" : "Nuevo plan"}
      description="Define el nombre, precio y duración. Lo verás en la pantalla de Caja al cobrar membresías."
    >
      <form action={formAction} className="space-y-4">
        <Input
          label="Nombre"
          name="nombre"
          required
          defaultValue={plan?.nombre}
          placeholder="Ej. Mensualidad estándar"
          error={state.fieldErrors.nombre}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Precio"
            name="precio"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            required
            leftSlot="$"
            defaultValue={plan?.precio}
            error={state.fieldErrors.precio}
          />
          <Input
            label="Duración (días)"
            name="dias_duracion"
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            required
            defaultValue={plan?.dias_duracion ?? 30}
            error={state.fieldErrors.dias_duracion}
          />
        </div>

        {state.error && Object.keys(state.fieldErrors).length === 0 && (
          <p
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {state.error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            {modal.mode === "edit" ? "Guardar" : "Crear plan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
