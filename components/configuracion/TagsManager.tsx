"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LuPencil, LuTrash2, LuPlus, LuTag } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
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

      <div className="space-y-2">
        <Label>Color</Label>
        {/* Muestras de color: botón circular (permitido), selección por anillo. */}
        <div className="flex flex-wrap gap-2">
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={colorLabels[c]}
              aria-label={colorLabels[c]}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={cn(
                "h-9 w-9 rounded-full transition-[box-shadow] duration-150",
                swatchStyles[c],
                color === c
                  ? "ring-2 ring-brand-green ring-offset-2 ring-offset-surface"
                  : "ring-1 ring-border hover:ring-text-secondary"
              )}
            />
          ))}
        </div>
        <div className="pt-1">
          <Badge variant={tagColorToVariant(color)}>
            {tag?.nombre || "Vista previa"}
          </Badge>
        </div>
      </div>

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
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Tags</h3>
            <p className="mt-1 text-sm text-text-secondary">
              {tags.length === 0
                ? "Sin tags. Crea el primero."
                : `${tags.length} tag${tags.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Button leftIcon={<LuPlus className="h-4 w-4" />} onClick={openCreate}>
            Nuevo tag
          </Button>
        </div>

        {tags.length === 0 ? (
          <EmptyState
            icon={<LuTag />}
            title="Sin tags todavía"
            description="Con los tags clasificas miembros y prospectos (turno, entrenador, promoción) y luego los filtras o les mandas mensajes en grupo."
            action={
              <Button leftIcon={<LuPlus className="h-4 w-4" />} onClick={openCreate}>
                Crear primer tag
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border border border-border bg-surface">
            {tags.map((tag) => {
              const total = tag.miembros_count + tag.prospectos_count;
              return (
                <li
                  key={tag.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={tagColorToVariant(tag.color)}>
                      {tag.nombre}
                    </Badge>
                    {total > 0 && (
                      <span className="text-xs text-text-muted">
                        <span className="font-mono tabular-nums">{total}</span>{" "}
                        uso{total !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(tag)}
                      aria-label={`Editar ${tag.nombre}`}
                    >
                      <LuPencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(tag)}
                      disabled={deletingId === tag.id}
                      aria-label={`Eliminar ${tag.nombre}`}
                      className="hover:text-danger"
                    >
                      <LuTrash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
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
