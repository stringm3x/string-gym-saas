"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { MiembroConTags } from "@/lib/queries/miembros.queries";
import type { Tag } from "@/lib/queries/tags.queries";
import { TagSelector } from "@/components/ui/TagSelector";
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
}

const initialState: MiembroFormState = {
  ok: false,
  error: null,
  fieldErrors: {},
};

export function MiembroForm({ mode, slug, miembro, defaultValues, prospectoId, availableTags = [], disabled = false }: MiembroFormProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const action =
    mode === "create"
      ? createMiembroAction
      : updateMiembroAction.bind(null, miembro!.id);

  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok && mode === "edit") {
      success("Miembro actualizado");
    } else if (state.error && !state.fieldErrors) {
      toastError("No se pudo guardar", state.error);
    }
  }, [state, mode, success, toastError]);

  const today = new Date().toISOString().slice(0, 10);

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
            defaultValue={miembro?.nombre ?? defaultValues?.nombre}
            placeholder="Ej. Juan Pérez"
            error={state.fieldErrors.nombre}
            autoComplete="name"
          />
        </div>

        <Input
          label="Teléfono"
          name="telefono"
          type="tel"
          defaultValue={miembro?.telefono ?? defaultValues?.telefono ?? ""}
          placeholder="55 1234 5678"
          error={state.fieldErrors.telefono}
          autoComplete="tel"
          description="Al menos teléfono o correo"
        />

        <Input
          label="Correo"
          name="email"
          type="email"
          defaultValue={miembro?.email ?? defaultValues?.email ?? ""}
          placeholder="correo@ejemplo.com"
          error={state.fieldErrors.email}
          autoComplete="email"
        />

        <Input
          label="Fecha de inscripción"
          name="fecha_inscripcion"
          type="date"
          required
          defaultValue={miembro?.fecha_inscripcion ?? today}
          error={state.fieldErrors.fecha_inscripcion}
        />

        <Input
          label="Vence el"
          name="fecha_vencimiento"
          type="date"
          defaultValue={miembro?.fecha_vencimiento ?? ""}
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
        <Button type="submit" loading={isPending}>
          {mode === "create" ? "Registrar miembro" : "Guardar cambios"}
        </Button>
      </div>
      </fieldset>
    </form>
  );
}
