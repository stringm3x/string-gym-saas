"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { updateNoShowPenaltyAction } from "@/app/(tenant)/[slug]/configuracion/clases/actions";

export function NoShowPenaltyForm({ inicial }: { inicial: number }) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [valor, setValor] = useState(String(inicial));
  const [isPending, start] = useTransition();

  function guardar() {
    const n = Number(valor);
    start(async () => {
      const r = await updateNoShowPenaltyAction(Number.isFinite(n) ? n : 0);
      if (!r.ok) {
        toastError("Error", r.error ?? "No se pudo guardar.");
        return;
      }
      success("Penalización guardada");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="text-sm font-semibold text-text-primary">
        Penalización por inasistencias
      </h3>
      <p className="mt-0.5 text-xs text-text-secondary">
        Bloquea nuevas reservas cuando un socio acumula demasiados no-shows en
        los últimos 30 días. Deja en 0 para desactivar.
      </p>
      <div className="mt-3 flex items-end gap-2">
        <label className="w-40">
          <span className="mb-1 block text-xs font-mono uppercase tracking-widest text-text-muted">
            Máx. no-shows (30 días)
          </span>
          <input
            type="number"
            min="0"
            step="1"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text-primary focus:border-brand-green focus:outline-none"
          />
        </label>
        <Button type="button" onClick={guardar} loading={isPending}>
          Guardar
        </Button>
      </div>
    </div>
  );
}
