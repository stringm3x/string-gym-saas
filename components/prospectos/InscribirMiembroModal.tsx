"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  createMiembroAction,
  type MiembroFormState,
} from "@/app/(tenant)/[slug]/miembros/actions";
import { calcularRangoPorDias } from "@/lib/utils/membresia-rango";
import { formatMoneda } from "@/lib/utils/format";
import type { ProspectoConTags } from "@/lib/queries/prospectos.queries";
import type { PlanMembresia } from "@/lib/queries/planes.queries";

const initialState: MiembroFormState = {
  ok: false,
  error: null,
  fieldErrors: {},
};

function hoyISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(
    n.getDate()
  ).padStart(2, "0")}`;
}

const selectClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:border-brand-green focus:outline-none";

interface Props {
  open: boolean;
  onClose: () => void;
  slug: string;
  prospecto: ProspectoConTags;
  planes: PlanMembresia[];
}

export function InscribirMiembroModal({
  open,
  onClose,
  slug,
  prospecto,
  planes,
}: Props) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [state, formAction, isPending] = useActionState(
    createMiembroAction,
    initialState
  );

  const [planId, setPlanId] = useState(planes[0]?.id ?? "");
  const [fechaInicio, setFechaInicio] = useState(hoyISO());
  const [monto, setMonto] = useState(
    planes[0]?.precio != null ? String(planes[0].precio) : ""
  );

  const plan = planes.find((p) => p.id === planId) ?? null;

  const fechaVencimiento = useMemo(() => {
    if (!plan || !fechaInicio) return "";
    const { periodo_fin } = calcularRangoPorDias(
      plan.dias_duracion,
      null,
      new Date(fechaInicio + "T00:00:00")
    );
    return periodo_fin;
  }, [plan, fechaInicio]);

  function cambiarPlan(id: string) {
    setPlanId(id);
    const p = planes.find((x) => x.id === id);
    if (p) setMonto(String(p.precio));
  }

  useEffect(() => {
    if (state.ok && state.miembroId) {
      success("Miembro creado");
      router.push(`/${slug}/miembros/${state.miembroId}`);
      return;
    }
    if (state.error && Object.keys(state.fieldErrors).length === 0) {
      toastError("Error", state.error);
    }
  }, [state]);

  const sinPlanes = planes.length === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Inscribir como miembro"
      description={prospecto.nombre}
      size="md"
    >
      {sinPlanes ? (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Primero crea un plan de membresía para poder inscribir a este
            prospecto.
          </p>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input
                label="Nombre"
                name="nombre"
                defaultValue={prospecto.nombre}
                required
                error={state.fieldErrors.nombre}
              />
            </div>
            <Input
              label="Teléfono"
              name="telefono"
              defaultValue={prospecto.telefono}
              error={state.fieldErrors.telefono}
            />
            <Input
              label="Correo"
              name="email"
              type="email"
              defaultValue={prospecto.email ?? ""}
              error={state.fieldErrors.email}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ins-plan">Plan de membresía</Label>
            <select
              id="ins-plan"
              value={planId}
              onChange={(e) => cambiarPlan(e.target.value)}
              className={selectClass}
            >
              {planes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — {formatMoneda(p.precio)} · {p.dias_duracion} días
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Inicio"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
            <Input label="Vencimiento" value={fechaVencimiento} readOnly disabled />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Monto a cobrar"
              name="monto_pago"
              type="number"
              min="0"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              error={state.fieldErrors.monto_pago}
            />
            <div className="space-y-1.5">
              <Label htmlFor="ins-metodo">Método de pago</Label>
              <select
                id="ins-metodo"
                name="metodo_pago"
                defaultValue="efectivo"
                className={selectClass}
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
          </div>

          {/* Campos que consume createMiembroAction */}
          <input type="hidden" name="prospecto_id" value={prospecto.id} />
          <input type="hidden" name="cobrar_inscripcion" value="true" />
          <input type="hidden" name="plan_id" value={planId} />
          <input type="hidden" name="promocion_id" value="" />
          <input type="hidden" name="fecha_inscripcion" value={fechaInicio} />
          <input type="hidden" name="fecha_vencimiento" value={fechaVencimiento} />
          <input type="hidden" name="periodo_inicio" value={fechaInicio} />
          <input type="hidden" name="periodo_fin" value={fechaVencimiento} />

          {state.error && Object.keys(state.fieldErrors).length > 0 && (
            <p className="text-xs text-danger">{state.error}</p>
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
              Inscribir
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
