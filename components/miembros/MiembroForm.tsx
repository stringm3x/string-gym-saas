"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { MiembroConTags } from "@/lib/queries/miembros.queries";
import type { Tag } from "@/lib/queries/tags.queries";
import type { PlanMembresia } from "@/lib/queries/planes.queries";
import type { Promocion } from "@/lib/queries/promociones.queries";
import { TagSelector } from "@/components/ui/TagSelector";
import { CobroInscripcion } from "@/components/miembros/CobroInscripcion";
import {
  createMiembroAction,
  updateMiembroAction,
  type MiembroFormState,
} from "@/app/(tenant)/[slug]/miembros/actions";

interface MiembroFormProps {
  mode: "create" | "edit";
  slug: string;
  miembro?: MiembroConTags;
  defaultValues?: { nombre?: string; telefono?: string; email?: string };
  prospectoId?: string;
  availableTags?: Tag[];
  disabled?: boolean;
  planes?: PlanMembresia[];
  promocionesMembresia?: Promocion[];
}

const initialState: MiembroFormState = {
  ok: false,
  error: null,
  fieldErrors: {},
};

export function MiembroForm({ mode, slug, miembro, defaultValues, prospectoId, availableTags = [], disabled = false, planes = [], promocionesMembresia = [] }: MiembroFormProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isNavigating, startNavigation] = useTransition();

  const action =
    mode === "create"
      ? createMiembroAction
      : updateMiembroAction.bind(null, miembro!.id);

  const [state, formAction, isPending] = useActionState(action, initialState);

  // Campos controlados: un fallo de validación en el servidor no debe
  // vaciar lo que el usuario ya escribió (React resetea los inputs no
  // controlados de un <form action> en cada submit, antes de recibir la
  // respuesta del server action).
  const [nombre, setNombre] = useState(
    miembro?.nombre ?? defaultValues?.nombre ?? ""
  );
  const [telefono, setTelefono] = useState(
    miembro?.telefono ?? defaultValues?.telefono ?? ""
  );
  const [email, setEmail] = useState(
    miembro?.email ?? defaultValues?.email ?? ""
  );
  const [fechaInscripcion, setFechaInscripcion] = useState(
    miembro?.fecha_inscripcion ?? new Date().toISOString().slice(0, 10)
  );
  const [fechaVencimiento, setFechaVencimiento] = useState(
    miembro?.fecha_vencimiento ?? ""
  );

  useEffect(() => {
    if (state.ok && mode === "edit") {
      success("Miembro actualizado");
    } else if (state.ok && mode === "create" && state.miembroId) {
      success(state.pagoId ? "Miembro registrado y cobrado" : "Miembro registrado");
      const destino = state.pagoId
        ? `/${slug}/recibos/${state.pagoId}`
        : `/${slug}/miembros/${state.miembroId}`;
      startNavigation(() => {
        router.push(destino);
      });
    } else if (state.error && !state.fieldErrors) {
      toastError("No se pudo guardar", state.error);
    }
  }, [state, mode, slug, router, success, toastError]);

  return (
    <form action={formAction} className="space-y-6">
      {prospectoId && (
        <input type="hidden" name="prospecto_id" value={prospectoId} />
      )}

      {disabled && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-text-secondary">
          Restaura este miembro para editarlo.
        </p>
      )}

      <fieldset disabled={disabled} className="space-y-6 disabled:opacity-60">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input
            label="Nombre completo"
            name="nombre"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Juan Pérez"
            error={state.fieldErrors.nombre}
            autoComplete="name"
          />
        </div>

        <Input
          label="Teléfono"
          name="telefono"
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="55 1234 5678"
          error={state.fieldErrors.telefono}
          autoComplete="tel"
          description="Al menos teléfono o correo · 10 dígitos"
        />

        <Input
          label="Correo"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@ejemplo.com"
          error={state.fieldErrors.email}
          autoComplete="email"
        />

        <Input
          label="Fecha de inscripción"
          name="fecha_inscripcion"
          type="date"
          required
          value={fechaInscripcion}
          onChange={(e) => setFechaInscripcion(e.target.value)}
          error={state.fieldErrors.fecha_inscripcion}
        />

        <Input
          label="Vence el"
          name="fecha_vencimiento"
          type="date"
          value={fechaVencimiento}
          onChange={(e) => setFechaVencimiento(e.target.value)}
          error={state.fieldErrors.fecha_vencimiento}
          description="Opcional — se calcula al registrar un pago"
        />
      </div>

      {availableTags.length > 0 && (
        <TagSelector
          tags={availableTags}
          initialSelectedIds={miembro?.tags.map((t) => t.id) ?? []}
          label="Tags"
        />
      )}

      {mode === "create" && (
        <CobroInscripcion
          planes={planes}
          promocionesMembresia={promocionesMembresia}
          fieldErrors={state.fieldErrors}
        />
      )}

      {state.duplicate && (
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs text-text-secondary"
        >
          <p>
            Ya existe un miembro parecido:{" "}
            <strong className="text-text-primary">
              {state.duplicate.nombre}
            </strong>
            {state.duplicate.telefono && ` · ${state.duplicate.telefono}`}
            {state.duplicate.email && ` · ${state.duplicate.email}`}
          </p>
          <div className="flex items-center gap-3">
            <Link
              href={`/${slug}/miembros/${state.duplicate.id}`}
              className="font-medium text-brand-green underline underline-offset-2 hover:opacity-80"
            >
              Ver registro existente
            </Link>
            <Button
              type="submit"
              name="confirmar_duplicado"
              value="true"
              variant="ghost"
              size="sm"
              loading={isPending}
            >
              Registrar de todos modos
            </Button>
          </div>
        </div>
      )}

      {state.error && Object.keys(state.fieldErrors).length === 0 && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(`/${slug}/miembros`)}
          disabled={isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" loading={isPending || isNavigating}>
          {mode === "create" ? "Registrar miembro" : "Guardar cambios"}
        </Button>
      </div>
      </fieldset>
    </form>
  );
}
