"use client";

import { useState, useTransition } from "react";
import { LuStickyNote } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { updateNotasLegacyAction } from "@/app/(tenant)/[slug]/miembros/actions";

interface NotasLegacyProps {
  miembroId: string;
  notas: string | null;
}

export function NotasLegacy({ miembroId, notas }: NotasLegacyProps) {
  const { success, error: toastError } = useToast();
  const [value, setValue] = useState(notas ?? "");
  const [isPending, startTransition] = useTransition();

  const dirty = value !== (notas ?? "");

  function handleSave() {
    startTransition(async () => {
      const result = await updateNotasLegacyAction(miembroId, value);
      if (!result.ok) {
        toastError("Error", result.error ?? "No se pudo guardar.");
        return;
      }
      success("Notas guardadas");
    });
  }

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <LuStickyNote className="h-4 w-4 text-text-muted" />
        Notas
      </h3>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder="Anota algo sobre este miembro…"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          Mejora a Plan Pro para tener historial de notas con timeline
          cronológico.
        </p>
        <Button size="sm" onClick={handleSave} loading={isPending} disabled={!dirty}>
          Guardar
        </Button>
      </div>
    </div>
  );
}
