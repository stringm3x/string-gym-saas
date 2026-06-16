"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LuPencil, LuTrash2, LuPlus, LuTag } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { tagColorToVariant } from "@/components/ui/TagSelector";
import {
  createTagAction,
  updateTagAction,
  deleteTagAction,
  type TagFormState,
} from "@/app/(tenant)/[slug]/configuracion/tags/actions";
import { TAG_COLORS, type TagColor } from "@/lib/validations/tag.schema";
import type { TagConConteo } from "@/lib/queries/tags.queries";
import { cn } from "@/lib/utils/cn";

const colorLabels: Record<TagColor, string> = {
  success: "Verde",
  warning: "Naranja",
  danger: "Rojo",
  info: "Dorado claro",
  neutral: "Gris",
  gold: "Dorado",
};

const swatchStyles: Record<TagColor, string> = {
  success: "bg-brand-green/80",
  warning: "bg-warning/80",
  danger: "bg-danger/80",
  info: "bg-gold/60",
  neutral: "bg-text-muted/40",
  gold: "bg-gold/80",
};

interface TagsManagerProps {
  tags: TagConConteo[];
}

const initialState: TagFormState = { ok: false, error: null, fieldErrors: {} };

function TagForm({
  tag,
  onClose,
}: {
  tag?: TagConConteo;
  onClose: () => void;
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const isEdit = Boolean(tag);

  const action = isEdit
    ? updateTagAction.bind(null, tag!.id)
    : createTagAction;

  const [state, formAction, isPending] = useActionState(action, initialState);
  const [color, setColor] = useState<TagColor>(tag?.color ?? "neutral");

  useEffect(() => {
    if (!state.ok) return;
    success(isEdit ? "Tag actualizado" : "Tag creado");
    router.refresh();
    onClose();
  }, [state.ok]);

  useEffect(() => {
    if (state.error && Object.keys(state.fieldErrors).length === 0) {
      toastError("Error", state.error);
    }
  }, [state.error]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="color" value={color} />

      <Input
        label="Nombre del tag"
        name="nombre"
        required
        defaultValue={tag?.nombre}
        placeholder="Ej. VIP, Pendiente de pago…"
        error={state.fieldErrors.nombre}
        autoFocus
      />

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-text-secondary">Color</p>
        <div className="flex flex-wrap gap-2">
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={colorLabels[c]}
              onClick={() => setColor(c)}
              className={cn(
                "h-7 w-7 rounded-full transition-all duration-150",
                swatchStyles[c],
                color === c
                  ? "ring-2 ring-brand-green ring-offset-2 ring-offset-bg"
                  : "opacity-60 hover:opacity-90"
              )}
            />
          ))}
        </div>
        <div className="mt-2">
          <Badge variant={tagColorToVariant(color)}>
            {tag?.nombre || "Vista previa"}
          </Badge>
        </div>
      </div>

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
          {isEdit ? "Guardar cambios" : "Crear tag"}
        </Button>
      </div>
    </form>
  );
}

export function TagsManager({ tags }: TagsManagerProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagConConteo | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditingTag(undefined);
    setModalOpen(true);
  }

  function openEdit(tag: TagConConteo) {
    setEditingTag(tag);
    setModalOpen(true);
  }

  async function handleDelete(tag: TagConConteo) {
    const usageText =
      tag.miembros_count + tag.prospectos_count > 0
        ? ` Está asignado a ${tag.miembros_count} miembro${tag.miembros_count !== 1 ? "s" : ""} y ${tag.prospectos_count} prospecto${tag.prospectos_count !== 1 ? "s" : ""}.`
        : "";

    if (
      !window.confirm(
        `¿Eliminar el tag "${tag.nombre}"?${usageText} Esta acción no se puede deshacer.`
      )
    )
      return;

    setDeletingId(tag.id);
    const result = await deleteTagAction(tag.id);
    setDeletingId(null);

    if (!result.ok) {
      toastError("Error", result.error ?? "No se pudo eliminar el tag.");
    } else {
      success("Tag eliminado");
      router.refresh();
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            {tags.length === 0
              ? "Sin tags. Crea el primero."
              : `${tags.length} tag${tags.length !== 1 ? "s" : ""}`}
          </p>
          <Button
            leftIcon={<LuPlus className="h-4 w-4" />}
            onClick={openCreate}
            size="sm"
          >
            Nuevo tag
          </Button>
        </div>

        {tags.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
            <LuTag className="h-8 w-8 text-text-muted" />
            <div>
              <p className="text-sm font-medium text-text-primary">Sin tags</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                Los tags te permiten clasificar miembros y prospectos.
              </p>
            </div>
            <Button
              leftIcon={<LuPlus className="h-4 w-4" />}
              onClick={openCreate}
              size="sm"
            >
              Crear primer tag
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border bg-surface">
            {tags.map((tag) => {
              const total = tag.miembros_count + tag.prospectos_count;
              return (
                <div
                  key={tag.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={tagColorToVariant(tag.color)}>
                      {tag.nombre}
                    </Badge>
                    {total > 0 && (
                      <span className="text-xs text-text-muted">
                        {total} uso{total !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(tag)}
                      className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
                      aria-label="Editar tag"
                    >
                      <LuPencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tag)}
                      disabled={deletingId === tag.id}
                      className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                      aria-label="Eliminar tag"
                    >
                      <LuTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTag ? "Editar tag" : "Nuevo tag"}
        size="sm"
      >
        <TagForm
          tag={editingTag}
          onClose={() => setModalOpen(false)}
        />
      </Modal>
    </>
  );
}
