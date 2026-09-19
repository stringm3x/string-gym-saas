"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LuPencil,
  LuTrash2,
  LuPlus,
  LuMessageSquare,
  LuListPlus,
} from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
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

      <div className="space-y-2">
        <Label htmlFor="categoria">Categoría</Label>
        <select
          id="categoria"
          name="categoria"
          defaultValue={plantilla?.categoria ?? "general"}
          className="h-11 w-full rounded border border-border bg-bg px-3 text-sm text-text-primary focus:border-brand-green focus:outline-none"
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

      <div className="space-y-2">
        <Label htmlFor="contenido">Contenido</Label>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-etiqueta uppercase text-text-muted">
            Variables
          </span>
          {VARIABLES.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVariable(v.key)}
              className="inline-flex h-9 items-center border border-border px-3 font-mono text-xs text-brand-green transition-colors hover:border-brand-green"
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
          className="w-full rounded border border-border bg-bg px-3 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
        />
        {state.fieldErrors.contenido && (
          <p className="text-xs text-danger">{state.fieldErrors.contenido}</p>
        )}
      </div>

      <input type="hidden" name="activo" value={plantilla?.activo === false ? "false" : "true"} />

      {state.error && Object.keys(state.fieldErrors).length === 0 && (
        <p className="border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-3 border-t border-border pt-4">
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
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              Plantillas de mensaje
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              {plantillas.length === 0
                ? "Sin plantillas"
                : `${plantillas.length} plantilla${plantillas.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Button leftIcon={<LuPlus className="h-4 w-4" />} onClick={openCreate}>
            Nueva plantilla
          </Button>
        </div>

        {plantillas.length === 0 ? (
          <EmptyState
            icon={<LuMessageSquare />}
            title="Sin plantillas todavía"
            description="Las plantillas aceleran tus mensajes de WhatsApp con variables como el nombre y la fecha de vencimiento. Empieza con las sugeridas o escribe la tuya."
            action={
              <>
                <Button
                  leftIcon={<LuPlus className="h-4 w-4" />}
                  onClick={openCreate}
                >
                  Crear plantilla
                </Button>
                <Button
                  leftIcon={<LuListPlus className="h-4 w-4" />}
                  onClick={handleSeed}
                  loading={seeding}
                  variant="secondary"
                >
                  Crear plantillas sugeridas
                </Button>
              </>
            }
          />
        ) : (
          <ul className="divide-y divide-border border border-border bg-surface">
            {plantillas.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
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
                  <p className="mt-0.5 truncate text-xs text-text-muted">
                    {p.contenido.slice(0, 90)}
                    {p.contenido.length > 90 ? "…" : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActivo(p)}
                    aria-pressed={p.activo}
                    className={p.activo ? "text-brand-green" : undefined}
                  >
                    {p.activo ? "Activa" : "Inactiva"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(p)}
                    aria-label={`Editar ${p.nombre}`}
                  >
                    <LuPencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(p)}
                    disabled={deletingId === p.id}
                    aria-label={`Eliminar ${p.nombre}`}
                    className="hover:text-danger"
                  >
                    <LuTrash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
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
