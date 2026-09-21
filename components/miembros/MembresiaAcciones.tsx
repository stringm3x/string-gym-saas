"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuSnowflake, LuSun, LuArrowLeftRight } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useToast } from "@/components/ui/Toast";
import { formatMoneda } from "@/lib/utils/format";
import { formatearFechaMX, hoyISO } from "@/lib/utils/dates";
import {
  congelarMembresiaAction,
  descongelarMembresiaAction,
  cambiarPlanAction,
  previsualizarCambioPlanAction,
} from "@/app/(tenant)/[slug]/miembros/[id]/membresia-actions";
import type { PlanMembresia } from "@/lib/queries/planes.queries";
import type { CambioPlanCalculo } from "@/lib/queries/miembro-eventos.queries";

const MOTIVO_SIN_PRORRATEO_MSG: Record<
  Extract<CambioPlanCalculo, { tipo: "sin_prorrateo" }>["motivo"],
  string
> = {
  sin_plan_actual: "El socio no tiene un plan actual del que prorratear.",
  plan_por_visitas:
    "Su plan actual es por visitas, no por días — no hay saldo que prorratear.",
  vencido: "Su membresía ya venció — no quedan días pagados que valgan algo.",
  sin_pago_vigente:
    "No se encontró el pago de su periodo actual — no se puede calcular cuánto pagó.",
};

interface Props {
  miembroId: string;
  planes: PlanMembresia[];
  /** Si hay una congelación vigente hoy: se muestra "Descongelar". */
  congelacionActiva?: boolean;
  disabled?: boolean;
}

export function MembresiaAcciones({
  miembroId,
  planes,
  congelacionActiva,
  disabled,
}: Props) {
  const [modal, setModal] = useState<null | "congelar" | "descongelar" | "plan">(
    null
  );

  return (
    <>
      {congelacionActiva ? (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<LuSun className="h-4 w-4" />}
          onClick={() => setModal("descongelar")}
          disabled={disabled}
          className="text-warning hover:text-warning"
        >
          Descongelar
        </Button>
      ) : (
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
      )}
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
      {modal === "descongelar" && (
        <DescongelarModal
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

  return (
    <Modal open onClose={onClose} title="Congelar membresía">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          La vigencia se recorre por los días de la pausa (no se pierden) y el
          check-in se bloquea durante el período.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Inicio"
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
          />
          <Input
            label="Fin"
            type="date"
            value={fin}
            min={inicio}
            onChange={(e) => setFin(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
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

function DescongelarModal({
  miembroId,
  onClose,
}: {
  miembroId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isPending, start] = useTransition();

  function descongelar() {
    start(async () => {
      const r = await descongelarMembresiaAction(miembroId);
      if (!r.ok) {
        toastError("No se pudo descongelar", r.error ?? "Inténtalo de nuevo");
        return;
      }
      success("Membresía descongelada");
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal open onClose={onClose} title="Descongelar membresía">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Se reanuda la membresía hoy. Los días de la pausa que aún no se
          consumieron se descuentan del vencimiento (solo cuentan los días que
          estuvo congelada). Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={descongelar} loading={isPending}>
            Descongelar
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
  const [calculo, setCalculo] = useState<CambioPlanCalculo | null>(null);
  const [calculoError, setCalculoError] = useState<string | null>(null);
  const [isPendingCalculo, startCalculo] = useTransition();
  const [isPending, start] = useTransition();

  const plan = planes.find((p) => p.id === planId) ?? null;

  // La cuenta la calcula el servidor (prorrateo sobre lo que realmente pagó
  // el socio) — nadie debería confirmar un cambio de plan sin verla.
  useEffect(() => {
    if (!planId) {
      setCalculo(null);
      return;
    }
    setCalculo(null);
    setCalculoError(null);
    startCalculo(async () => {
      const r = await previsualizarCambioPlanAction(miembroId, planId);
      if (!r.ok) {
        setCalculoError(r.error);
        return;
      }
      setCalculo(r.calculo);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, miembroId]);

  function cambiar() {
    if (!planId || !calculo) return;
    start(async () => {
      const r = await cambiarPlanAction(miembroId, planId);
      if (!r.ok) {
        toastError("No se pudo cambiar", r.error ?? "Inténtalo de nuevo");
        return;
      }
      success(
        "Plan cambiado",
        r.notaCredito
          ? `Se generó una nota de crédito de ${formatMoneda(r.notaCredito)}.`
          : undefined
      );
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal open onClose={onClose} title="Cambiar plan">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          El saldo de los días no consumidos del plan actual (sobre lo que
          realmente pagó) se convierte en días completos del plan nuevo — lo
          que no alcanza para un día completo, o lo que sobra después de un
          periodo entero, se emite como nota de crédito en vez de perderse.
        </p>
        <div className="space-y-2">
          <Label htmlFor="cambiar-plan">Plan</Label>
          <select
            id="cambiar-plan"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="h-11 w-full cursor-pointer rounded border border-border bg-bg px-3 text-sm text-text-primary focus:border-brand-green focus:outline-none"
          >
            {planes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — {formatMoneda(p.precio)}
              </option>
            ))}
          </select>
        </div>

        {isPendingCalculo && (
          <p className="text-sm text-text-muted">Calculando…</p>
        )}

        {calculoError && !isPendingCalculo && (
          <div className="border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {calculoError}
          </div>
        )}

        {calculo && !isPendingCalculo && (
          <div className="space-y-2 border border-border bg-bg px-4 py-3 text-sm">
            {calculo.tipo === "sin_prorrateo" ? (
              <p className="text-text-secondary">
                {MOTIVO_SIN_PRORRATEO_MSG[calculo.motivo]} Sin pago
                registrado: se conserva la vigencia actual. El plan nuevo
                aplica desde la próxima renovación.
              </p>
            ) : (
              <>
                <Fila
                  label="Días que le quedan"
                  valor={`${calculo.diasRestantes} día${calculo.diasRestantes === 1 ? "" : "s"}`}
                />
                <Fila
                  label="Valor de esos días"
                  valor={formatMoneda(calculo.valorDiasRestantes)}
                />
                <Fila
                  label="Días del plan nuevo que recibe"
                  valor={`${calculo.diasNuevoPlan} día${calculo.diasNuevoPlan === 1 ? "" : "s"}${
                    calculo.diasCompletos ? " (periodo completo)" : ""
                  }`}
                />
                {calculo.notaCredito > 0 && (
                  <Fila
                    label="Saldo a favor (nota de crédito)"
                    valor={formatMoneda(calculo.notaCredito)}
                  />
                )}
              </>
            )}
            <div className="flex items-center justify-between gap-4 border-t border-border pt-2">
              <span className="text-text-secondary">
                {calculo.tipo === "prorrateo" ? "Nueva vigencia hasta" : "Vigencia (sin cambio)"}
              </span>
              <span className="font-mono text-dato tabular-nums text-text-primary">
                {calculo.nuevoVencimiento
                  ? formatearFechaMX(calculo.nuevoVencimiento)
                  : "Sin vigencia registrada"}
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={cambiar}
            loading={isPending}
            disabled={!calculo || isPendingCalculo}
          >
            Cambiar plan
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-text-secondary">{label}</span>
      <span className="font-mono text-dato tabular-nums text-text-primary">
        {valor}
      </span>
    </div>
  );
}
