"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
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
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-text-primary">Notas</h3>

      <div className="space-y-2">
        <Label htmlFor="notas-legacy">Notas del miembro</Label>
        <textarea
          id="notas-legacy"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          placeholder="Anota algo sobre este miembro…"
          className="w-full rounded border border-border bg-bg px-3 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-text-muted">
          Con el plan Pro las notas llevan fecha, autor y seguimientos.
        </p>
        <Button size="sm" onClick={handleSave} loading={isPending} disabled={!dirty}>
          Guardar
        </Button>
      </div>
    </div>
  );
}
