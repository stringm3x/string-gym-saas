"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LuPencilLine, LuStickyNote } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  createNotaAction,
  type NotaFormState,
} from "@/app/(tenant)/[slug]/miembros/actions";
import type { Nota } from "@/lib/queries/notas.queries";

const initialState: NotaFormState = { ok: false, error: null };

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface NotasTimelineProps {
  miembroId: string;
  notas: Nota[];
  legacyNotas: string | null;
}

export function NotasTimeline({
  miembroId,
  notas,
  legacyNotas,
}: NotasTimelineProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [state, formAction, isPending] = useActionState(
    createNotaAction.bind(null, miembroId),
    initialState
  );

  useEffect(() => {
    if (state.ok) {
      success("Nota guardada");
      if (textareaRef.current) textareaRef.current.value = "";
      router.refresh();
    } else if (state.error) {
      toastError("Error", state.error);
    }
  }, [state]);

  const isEmpty = notas.length === 0 && !legacyNotas;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text-primary">Notas</h3>

      {legacyNotas && (
        <div className="rounded-lg border border-border bg-surface-hover p-3">
          <p className="mb-1 text-xs font-medium text-text-muted">
            Notas anteriores
          </p>
          <p className="whitespace-pre-wrap text-sm text-text-secondary">
            {legacyNotas}
          </p>
        </div>
      )}

      <form action={formAction} className="space-y-2">
        <textarea
          ref={textareaRef}
          name="contenido"
          rows={3}
          placeholder="Escribe una nota…"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
          required
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            leftIcon={<LuPencilLine className="h-3.5 w-3.5" />}
            loading={isPending}
          >
            Agregar nota
          </Button>
        </div>
      </form>

      {isEmpty ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-6">
          <LuStickyNote className="h-4 w-4 text-text-muted" />
          <p className="text-sm text-text-muted">Sin notas aún</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notas.map((nota) => (
            <li
              key={nota.id}
              className="rounded-lg border border-border bg-surface p-3"
            >
              <p className="whitespace-pre-wrap text-sm text-text-primary">
                {nota.contenido}
              </p>
              <p className="mt-1.5 text-xs text-text-muted">
                {formatDateTime(nota.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
