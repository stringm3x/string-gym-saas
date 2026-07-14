"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuSnowflake, LuArrowLeftRight } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatMoneda } from "@/lib/utils/format";
import { formatearFechaMX, isoMasDias, hoyISO } from "@/lib/utils/dates";
import {
  congelarMembresiaAction,
  cambiarPlanAction,
} from "@/app/(tenant)/[slug]/miembros/[id]/membresia-actions";
import type { PlanMembresia } from "@/lib/queries/planes.queries";

interface Props {
  miembroId: string;
  planes: PlanMembresia[];
  disabled?: boolean;
}

export function MembresiaAcciones({ miembroId, planes, disabled }: Props) {
  const [modal, setModal] = useState<null | "congelar" | "plan">(null);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<LuSnowflake className="h-4 w-4" />}
        onClick={() => setModal("congelar")}
        disabled={disabled}
        className="text-text-secondary hover:text-brand-green"
      >
        Congelar
      </Button>
      {planes.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<LuArrowLeftRight className="h-4 w-4" />}
          onClick={() => setModal("plan")}
          disabled={disabled}
          className="text-text-secondary hover:text-brand-green"
        >
          Cambiar plan
        </Button>
      )}

      {modal === "congelar" && (
        <CongelarModal
          miembroId={miembroId}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "plan" && (
        <CambiarPlanModal
          miembroId={miembroId}
          planes={planes}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

function CongelarModal({
  miembroId,
  onClose,
}: {
  miembroId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [inicio, setInicio] = useState(hoyISO());
  const [fin, setFin] = useState("");
  const [isPending, start] = useTransition();

  function congelar() {
    if (!inicio || !fin) {
      toastError("Faltan fechas", "Indica inicio y fin de la pausa.");
      return;
    }
    start(async () => {
      const r = await congelarMembresiaAction(miembroId, inicio, fin);
      if (!r.ok) {
        toastError("No se pudo congelar", r.error ?? "Inténtalo de nuevo");
        return;
      }
      success("Membresía congelada");
      onClose();
      router.refresh();
    });
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text-primary focus:border-brand-green focus:outline-none";

  return (
    <Modal open onClose={onClose} title="Congelar membresía">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          La vigencia se recorre por los días de la pausa (no se pierden) y el
          check-in se bloquea durante el período.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="mb-1 block text-xs font-mono uppercase tracking-widest text-text-muted">
              Inicio
            </span>
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className={inputCls}
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-mono uppercase tracking-widest text-text-muted">
              Fin
            </span>
            <input
              type="date"
              value={fin}
              min={inicio}
              onChange={(e) => setFin(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={congelar} loading={isPending}>
            Congelar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CambiarPlanModal({
  miembroId,
  planes,
  onClose,
}: {
  miembroId: string;
  planes: PlanMembresia[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [planId, setPlanId] = useState(planes[0]?.id ?? "");
  const [isPending, start] = useTransition();

  const plan = planes.find((p) => p.id === planId) ?? null;
  const nuevaVigencia = plan
    ? isoMasDias(plan.dias_duracion, hoyISO())
    : null;

  function cambiar() {
    if (!planId) return;
    start(async () => {
      const r = await cambiarPlanAction(miembroId, planId);
      if (!r.ok) {
        toastError("No se pudo cambiar", r.error ?? "Inténtalo de nuevo");
        return;
      }
      success("Plan cambiado");
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal open onClose={onClose} title="Cambiar plan">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Cambia el plan del socio. La vigencia se recalcula a hoy + la duración
          del nuevo plan. No genera cobro.
        </p>
        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          className="w-full cursor-pointer rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:border-brand-green focus:outline-none"
        >
          {planes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} — {formatMoneda(p.precio)}
            </option>
          ))}
        </select>
        {plan && nuevaVigencia && (
          <div className="rounded-lg border border-border bg-bg p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Nueva vigencia hasta</span>
              <span className="font-medium text-text-primary">
                {formatearFechaMX(nuevaVigencia)}
              </span>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={cambiar} loading={isPending}>
            Cambiar plan
          </Button>
        </div>
      </div>
    </Modal>
  );
}
