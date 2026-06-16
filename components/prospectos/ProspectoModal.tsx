"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { LuArrowRight } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { TagSelector } from "@/components/ui/TagSelector";
import { AccionesRapidas } from "@/components/ui/AccionesRapidas";
import {
  createProspectoAction,
  updateProspectoAction,
  type ProspectoFormState,
} from "@/app/(tenant)/[slug]/prospectos/actions";
import { ORIGENES, ESTADOS } from "@/lib/validations/prospecto.schema";
import type { ProspectoConTags } from "@/lib/queries/prospectos.queries";
import type { Tag } from "@/lib/queries/tags.queries";
import type { PlantillaMensaje } from "@/lib/queries/plantillas.queries";

const origenLabels: Record<(typeof ORIGENES)[number], string> = {
  landing: "Landing",
  whatsapp: "WhatsApp",
  referido: "Referido",
  manual: "Manual",
};

const estadoLabels: Record<(typeof ESTADOS)[number], string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  agendado: "Agendado",
  convertido: "Convertido",
  descartado: "Descartado",
};

interface ProspectoModalProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  prospecto?: ProspectoConTags;
  availableTags?: Tag[];
  plantillas?: PlantillaMensaje[];
  onSuccess?: () => void;
}

const initialState: ProspectoFormState = {
  ok: false,
  error: null,
  fieldErrors: {},
};

export function ProspectoModal({
  open,
  onClose,
  slug,
  prospecto,
  availableTags = [],
  plantillas = [],
  onSuccess,
}: ProspectoModalProps) {
  const { success, error: toastError } = useToast();
  const isEdit = Boolean(prospecto);

  const action = isEdit
    ? updateProspectoAction.bind(null, prospecto!.id)
    : createProspectoAction;

  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (!state.ok) return;
    success(isEdit ? "Prospecto actualizado" : "Prospecto creado");
    onSuccess?.();
    onClose();
  }, [state.ok]);

  useEffect(() => {
    if (state.error && Object.keys(state.fieldErrors).length === 0) {
      toastError("Error", state.error);
    }
  }, [state.error]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar prospecto" : "Nuevo prospecto"}
      size="lg"
    >
      {isEdit && prospecto && (
        <div className="mb-4 rounded-xl border border-border bg-surface-hover px-4 py-3">
          <AccionesRapidas
            nombre={prospecto.nombre}
            telefono={prospecto.telefono}
            email={prospecto.email ?? null}
            entidadTipo="prospecto"
            entidadId={prospecto.id}
            plantillas={plantillas}
          />
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Nombre completo"
              name="nombre"
              required
              defaultValue={prospecto?.nombre}
              placeholder="Ej. María López"
              error={state.fieldErrors.nombre}
              autoComplete="name"
            />
          </div>

          <Input
            label="Teléfono"
            name="telefono"
            type="tel"
            required
            defaultValue={prospecto?.telefono}
            placeholder="55 1234 5678"
            error={state.fieldErrors.telefono}
            autoComplete="tel"
          />

          <Input
            label="Correo"
            name="email"
            type="email"
            defaultValue={prospecto?.email ?? ""}
            placeholder="correo@ejemplo.com"
            error={state.fieldErrors.email}
            autoComplete="email"
          />

          <div className="space-y-1.5">
            <Label htmlFor="origen">Origen</Label>
            <select
              id="origen"
              name="origen"
              defaultValue={prospecto?.origen ?? "manual"}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:border-brand-green focus:outline-none"
            >
              {ORIGENES.map((o) => (
                <option key={o} value={o}>
                  {origenLabels[o]}
                </option>
              ))}
            </select>
          </div>

          {isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="estado">Estado</Label>
              <select
                id="estado"
                name="estado"
                defaultValue={prospecto?.estado}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:border-brand-green focus:outline-none"
              >
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {estadoLabels[e]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isEdit && (
            <input type="hidden" name="estado" value="nuevo" />
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fecha_prueba_agendada">
              Fecha de clase de prueba{" "}
              <span className="text-text-muted">(opcional)</span>
            </Label>
            <input
              id="fecha_prueba_agendada"
              name="fecha_prueba_agendada"
              type="datetime-local"
              defaultValue={prospecto?.fecha_prueba_agendada?.slice(0, 16) ?? ""}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:border-brand-green focus:outline-none"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notas">Notas</Label>
            <textarea
              id="notas"
              name="notas"
              rows={3}
              defaultValue={prospecto?.notas ?? ""}
              placeholder="Observaciones, preferencias, horarios…"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
            />
          </div>

          {availableTags.length > 0 && (
            <div className="sm:col-span-2">
              <TagSelector
                tags={availableTags}
                initialSelectedIds={prospecto?.tags.map((t) => t.id) ?? []}
                label="Tags"
              />
            </div>
          )}
        </div>

        {state.error && Object.keys(state.fieldErrors).length === 0 && (
          <p
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {state.error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          {isEdit ? (
            <Link
              href={`/${slug}/miembros/nuevo?prospecto_id=${prospecto!.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green/10 px-3 py-2 text-sm font-medium text-brand-green border border-brand-green/30 transition-colors hover:bg-brand-green/20"
            >
              Convertir a miembro
              <LuArrowRight size={14} />
            </Link>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" loading={isPending}>
              {isEdit ? "Guardar cambios" : "Crear prospecto"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
