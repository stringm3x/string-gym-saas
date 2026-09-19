"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LuSearch, LuX } from "react-icons/lu";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
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
import { searchMiembrosAction } from "@/app/(tenant)/[slug]/checkins/actions";

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
  /** Nombre del referidor, si `miembro.referido_por` ya está capturado. */
  referidoPorNombre?: string | null;
}

const initialState: MiembroFormState = {
  ok: false,
  error: null,
  fieldErrors: {},
};

export function MiembroForm({ mode, slug, miembro, defaultValues, prospectoId, availableTags = [], disabled = false, planes = [], promocionesMembresia = [], referidoPorNombre = null }: MiembroFormProps) {
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
  const [fechaNacimiento, setFechaNacimiento] = useState(
    miembro?.fecha_nacimiento ?? ""
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
        <p className="border border-warning/40 px-4 py-3 text-sm text-text-secondary">
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

        <Input
          label="Fecha de nacimiento"
          name="fecha_nacimiento"
          type="date"
          value={fechaNacimiento}
          onChange={(e) => setFechaNacimiento(e.target.value)}
          error={state.fieldErrors.fecha_nacimiento}
          description="Opcional — para felicitarlo en su cumpleaños"
        />

        <div className="sm:col-span-2">
          <ReferidoPorField
            excludeId={miembro?.id}
            initialId={miembro?.referido_por ?? null}
            initialNombre={referidoPorNombre}
            error={state.fieldErrors.referido_por}
          />
        </div>
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
          className="space-y-3 border border-warning/40 px-4 py-3 text-sm text-text-secondary"
        >
          <p>
            Ya existe un miembro parecido:{" "}
            <strong className="font-medium text-text-primary">
              {state.duplicate.nombre}
            </strong>
            {state.duplicate.telefono && (
              <span className="font-mono"> · {state.duplicate.telefono}</span>
            )}
            {state.duplicate.email && ` · ${state.duplicate.email}`}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/${slug}/miembros/${state.duplicate.id}`}
              className="inline-flex h-9 items-center text-sm text-text-primary underline-offset-4 hover:text-brand-green hover:underline"
            >
              Ver registro existente
            </Link>
            <Button
              type="submit"
              name="confirmar_duplicado"
              value="true"
              variant="secondary"
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
          className="border border-danger/40 px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="secondary"
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

function ReferidoPorField({
  excludeId,
  initialId,
  initialNombre,
  error,
}: {
  excludeId?: string;
  initialId: string | null;
  initialNombre: string | null;
  error?: string;
}) {
  const [selected, setSelected] = useState<{ id: string; nombre: string } | null>(
    initialId && initialNombre ? { id: initialId, nombre: initialNombre } : null
  );
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<
    { id: string; nombre: string; telefono: string | null }[]
  >([]);

  useEffect(() => {
    if (selected) return;
    let cancelado = false;
    const t = window.setTimeout(async () => {
      if (query.trim().length < 2) {
        if (!cancelado) setResultados([]);
        return;
      }
      const r = await searchMiembrosAction(query);
      if (!cancelado) {
        setResultados(r.filter((m) => m.id !== excludeId));
      }
    }, 250);
    return () => {
      cancelado = true;
      window.clearTimeout(t);
    };
  }, [query, selected, excludeId]);

  return (
    <div className="space-y-2">
      <Label htmlFor="referido-por">Referido por</Label>
      <input type="hidden" name="referido_por" value={selected?.id ?? ""} />

      {selected ? (
        <div className="flex items-center justify-between gap-3 border border-border bg-bg py-1 pl-4 pr-1">
          <span className="truncate text-[15px] leading-5 text-text-primary">
            {selected.nombre}
          </span>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setQuery("");
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
            aria-label="Quitar referido"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Input
            id="referido-por"
            type="search"
            placeholder="Buscar miembro que lo refirió…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftSlot={<LuSearch className="h-4 w-4" />}
            autoComplete="off"
          />
          {resultados.length > 0 && (
            <ul className="absolute z-10 mt-2 w-full divide-y divide-border overflow-hidden border border-border bg-surface">
              {resultados.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected({ id: m.id, nombre: m.nombre });
                      setResultados([]);
                    }}
                    className="flex min-h-11 w-full items-center justify-between gap-4 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover"
                  >
                    <span className="truncate text-[15px] leading-5 text-text-primary">
                      {m.nombre}
                    </span>
                    {m.telefono && (
                      <span className="shrink-0 font-mono text-dato text-text-muted">
                        {m.telefono}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <p className="text-xs text-text-muted">
        Opcional — para llevar el conteo de referidos de cada miembro
      </p>
    </div>
  );
}
