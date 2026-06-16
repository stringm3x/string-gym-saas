"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LuPencil,
  LuTrash2,
  LuPlus,
  LuMessageSquare,
  LuSparkles,
} from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import {
  createPlantillaAction,
  updatePlantillaAction,
  deletePlantillaAction,
  toggleActivoAction,
  seedPlantillasAction,
  type PlantillaFormState,
} from "@/app/(tenant)/[slug]/configuracion/plantillas/actions";
import {
  PLANTILLA_CATEGORIAS,
  type PlantillaCategoria,
} from "@/lib/validations/plantilla.schema";
import type { PlantillaMensaje } from "@/lib/queries/plantillas.queries";
import type { BadgeVariant } from "@/components/ui/Badge";

const categoriaLabels: Record<PlantillaCategoria, string> = {
  miembro_activo: "Miembro activo",
  miembro_por_vencer: "Por vencer",
  miembro_vencido: "Vencido",
  prospecto: "Prospecto",
  general: "General",
};

const categoriaBadge: Record<PlantillaCategoria, BadgeVariant> = {
  miembro_activo: "success",
  miembro_por_vencer: "warning",
  miembro_vencido: "danger",
  prospecto: "info",
  general: "neutral",
};

const VARIABLES = [
  { key: "nombre", label: "{{nombre}}" },
  { key: "fecha_vencimiento", label: "{{fecha_vencimiento}}" },
  { key: "gym_nombre", label: "{{gym_nombre}}" },
];

const initialState: PlantillaFormState = {
  ok: false,
  error: null,
  fieldErrors: {},
};

function PlantillaForm({
  plantilla,
  onClose,
}: {
  plantilla?: PlantillaMensaje;
  onClose: () => void;
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const isEdit = Boolean(plantilla);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const action = isEdit
    ? updatePlantillaAction.bind(null, plantilla!.id)
    : createPlantillaAction;

  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (!state.ok) return;
    success(isEdit ? "Plantilla actualizada" : "Plantilla creada");
    router.refresh();
    onClose();
  }, [state.ok]);

  useEffect(() => {
    if (state.error && Object.keys(state.fieldErrors).length === 0) {
      toastError("Error", state.error);
    }
  }, [state.error]);

  function insertVariable(varKey: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const snippet = `{{${varKey}}}`;
    el.value =
      el.value.slice(0, start) + snippet + el.value.slice(end);
    const pos = start + snippet.length;
    el.selectionStart = el.selectionEnd = pos;
    el.focus();
  }

  return (
    <form action={formAction} className="space-y-4">
      <Input
        label="Nombre de la plantilla"
        name="nombre"
        required
        defaultValue={plantilla?.nombre}
        placeholder="Ej. Recordatorio vencimiento"
        error={state.fieldErrors.nombre}
        autoFocus
      />

      <div className="space-y-1.5">
        <Label htmlFor="categoria">Categoría</Label>
        <select
          id="categoria"
          name="categoria"
          defaultValue={plantilla?.categoria ?? "general"}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:border-brand-green focus:outline-none"
        >
          {PLANTILLA_CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {categoriaLabels[c]}
            </option>
          ))}
        </select>
        {state.fieldErrors.categoria && (
          <p className="text-xs text-danger">{state.fieldErrors.categoria}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contenido">Contenido</Label>

        <div className="flex flex-wrap gap-1.5 rounded-lg border border-border/60 bg-surface-hover px-3 py-2">
          <span className="text-xs text-text-muted">Insertar variable:</span>
          {VARIABLES.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVariable(v.key)}
              className="rounded bg-brand-green/10 px-1.5 py-0.5 font-mono text-xs text-brand-green hover:bg-brand-green/20 transition-colors"
            >
              {v.label}
            </button>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          id="contenido"
          name="contenido"
          rows={5}
          required
          defaultValue={plantilla?.contenido}
          placeholder="Hola {{nombre}}, tu membresía en {{gym_nombre}}…"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
        />
        {state.fieldErrors.contenido && (
          <p className="text-xs text-danger">{state.fieldErrors.contenido}</p>
        )}
      </div>

      <input type="hidden" name="activo" value={plantilla?.activo === false ? "false" : "true"} />

      {state.error && Object.keys(state.fieldErrors).length === 0 && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" loading={isPending}>
          {isEdit ? "Guardar cambios" : "Crear plantilla"}
        </Button>
      </div>
    </form>
  );
}

interface PlantillasManagerProps {
  plantillas: PlantillaMensaje[];
}

export function PlantillasManager({ plantillas }: PlantillasManagerProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PlantillaMensaje | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  function openCreate() {
    setEditing(undefined);
    setModalOpen(true);
  }

  function openEdit(p: PlantillaMensaje) {
    setEditing(p);
    setModalOpen(true);
  }

  async function handleDelete(p: PlantillaMensaje) {
    if (
      !window.confirm(
        `¿Eliminar la plantilla "${p.nombre}"? Esta acción no se puede deshacer.`
      )
    )
      return;

    setDeletingId(p.id);
    const result = await deletePlantillaAction(p.id);
    setDeletingId(null);

    if (!result.ok) {
      toastError("Error", result.error ?? "No se pudo eliminar la plantilla.");
    } else {
      success("Plantilla eliminada");
      router.refresh();
    }
  }

  async function handleToggleActivo(p: PlantillaMensaje) {
    const result = await toggleActivoAction(p.id, !p.activo);
    if (!result.ok) {
      toastError("Error", result.error ?? "No se pudo actualizar.");
    } else {
      router.refresh();
    }
  }

  async function handleSeed() {
    setSeeding(true);
    const result = await seedPlantillasAction();
    setSeeding(false);

    if (!result.ok) {
      toastError("Error", result.error ?? "No se pudieron crear las plantillas.");
    } else {
      success(`${result.count} plantillas creadas`);
      router.refresh();
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            {plantillas.length === 0
              ? "Sin plantillas."
              : `${plantillas.length} plantilla${plantillas.length !== 1 ? "s" : ""}`}
          </p>
          <Button
            leftIcon={<LuPlus className="h-4 w-4" />}
            onClick={openCreate}
            size="sm"
          >
            Nueva plantilla
          </Button>
        </div>

        {plantillas.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-12 text-center">
            <LuMessageSquare className="h-8 w-8 text-text-muted" />
            <div>
              <p className="text-sm font-medium text-text-primary">
                Sin plantillas de mensaje
              </p>
              <p className="mt-0.5 text-xs text-text-secondary">
                Las plantillas aceleran tus mensajes de WhatsApp con variables
                como nombre y fecha de vencimiento.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                leftIcon={<LuSparkles className="h-4 w-4" />}
                onClick={handleSeed}
                loading={seeding}
                variant="ghost"
                size="sm"
              >
                Crear plantillas sugeridas
              </Button>
              <Button
                leftIcon={<LuPlus className="h-4 w-4" />}
                onClick={openCreate}
                size="sm"
              >
                Crear plantilla
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border bg-surface">
            {plantillas.map((p) => (
              <div
                key={p.id}
                className="flex items-start justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        p.activo ? "text-text-primary" : "text-text-muted line-through"
                      }`}
                    >
                      {p.nombre}
                    </span>
                    <Badge variant={categoriaBadge[p.categoria]}>
                      {categoriaLabels[p.categoria]}
                    </Badge>
                    {!p.activo && (
                      <Badge variant="neutral">Inactiva</Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-text-muted">
                    {p.contenido.slice(0, 90)}
                    {p.contenido.length > 90 ? "…" : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleActivo(p)}
                    title={p.activo ? "Desactivar" : "Activar"}
                    className={`rounded-md px-2 py-1 text-xs transition-colors ${
                      p.activo
                        ? "text-brand-green hover:bg-brand-green/10"
                        : "text-text-muted hover:bg-surface-hover"
                    }`}
                  >
                    {p.activo ? "Activa" : "Inactiva"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
                    aria-label="Editar plantilla"
                  >
                    <LuPencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p)}
                    disabled={deletingId === p.id}
                    className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    aria-label="Eliminar plantilla"
                  >
                    <LuTrash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar plantilla" : "Nueva plantilla"}
        size="lg"
      >
        <PlantillaForm
          plantilla={editing}
          onClose={() => setModalOpen(false)}
        />
      </Modal>
    </>
  );
}
