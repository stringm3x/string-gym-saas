"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { LuPencil, LuPlus, LuPackage } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
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
  const [modalKey, setModalKey] = useState(0);

  function openModal(m: { mode: "create" } | { mode: "edit"; plan: PlanMembresia }) {
    setModal(m);
    setModalKey((k) => k + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            Planes de membresía
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            {planes.length === 0
              ? "Sin planes definidos"
              : `${planes.length} ${planes.length === 1 ? "plan" : "planes"}`}
          </p>
        </div>
        <Button
          leftIcon={<LuPlus className="h-4 w-4" />}
          onClick={() => openModal({ mode: "create" })}
        >
          Nuevo plan
        </Button>
      </div>

      {planes.length === 0 ? (
        <EmptyState
          icon={<LuPackage />}
          title="Todavía no hay planes"
          description="Define los planes que vendes (mensualidad, trimestre, visita) con precio y duración: en caja se cobran con un clic."
          action={
            <Button
              leftIcon={<LuPlus className="h-4 w-4" />}
              onClick={() => openModal({ mode: "create" })}
            >
              Crear primer plan
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border border border-border bg-surface">
          {planes.map((p) => (
            <PlanRow
              key={p.id}
              plan={p}
              onEdit={() => openModal({ mode: "edit", plan: p })}
            />
          ))}
        </ul>
      )}

      <PlanFormModal key={modalKey} modal={modal} onClose={() => setModal(null)} />
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
    <li className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-text-primary">
            {plan.nombre}
          </p>
          {!plan.activo && <Badge variant="neutral">Archivado</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-text-secondary">
          {plan.tipo === "tiempo"
            ? `${plan.dias_duracion} ${plan.dias_duracion === 1 ? "día" : "días"}`
            : `${plan.visitas ?? 0} visitas · válido ${plan.dias_duracion} días`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-dato font-bold tabular-nums text-text-primary">
          {formatMoneda(plan.precio)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggle}
          disabled={isPending}
          className={cn(!plan.activo && "text-brand-green")}
        >
          {plan.activo ? "Archivar" : "Activar"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          aria-label={`Editar ${plan.nombre}`}
        >
          <LuPencil className="h-4 w-4" />
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
  const planInicial = modal?.mode === "edit" ? modal.plan : undefined;
  const [tipo, setTipo] = useState<"tiempo" | "visitas" | "paquete">(
    planInicial?.tipo ?? "tiempo"
  );

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
            label={tipo === "tiempo" ? "Duración (días)" : "Validez (días)"}
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

        <div className="space-y-2">
          <Label>Tipo de plan</Label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { v: "tiempo", l: "Por tiempo" },
                { v: "visitas", l: "Por visitas" },
                { v: "paquete", l: "Paquete" },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setTipo(o.v)}
                aria-pressed={tipo === o.v}
                className={cn(
                  "h-11 border px-2 text-sm font-semibold transition-colors",
                  tipo === o.v
                    ? "border-brand-green bg-surface-hover text-brand-green"
                    : "border-border bg-transparent text-text-secondary hover:border-text-secondary hover:text-text-primary"
                )}
              >
                {o.l}
              </button>
            ))}
          </div>
          <input type="hidden" name="tipo" value={tipo} />
          <p className="text-xs text-text-muted">
            {tipo === "tiempo"
              ? "Vigente por los días indicados."
              : tipo === "visitas"
                ? "Se descuenta 1 visita por check-in (la validez es un tope amplio)."
                : "Visitas + validez máxima en días."}
          </p>
        </div>

        {tipo !== "tiempo" && (
          <Input
            label="Número de visitas"
            name="visitas"
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            required
            defaultValue={plan?.visitas ?? undefined}
            placeholder="Ej. 10"
            error={state.fieldErrors.visitas}
          />
        )}

        {state.error && Object.keys(state.fieldErrors).length === 0 && (
          <p
            role="alert"
            className="border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {state.error}
          </p>
        )}

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
            {modal.mode === "edit" ? "Guardar" : "Crear plan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
