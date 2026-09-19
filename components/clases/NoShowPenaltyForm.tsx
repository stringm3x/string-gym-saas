"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
    <section className="card-surface">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-text-primary">
          Penalización por inasistencias
        </h3>
        <p className="mt-0.5 text-sm text-text-muted">
          Bloquea nuevas reservas cuando un miembro acumula demasiadas
          inasistencias en los últimos 30 días. Deja en 0 para desactivar.
        </p>
      </div>
      <div className="flex items-end gap-3 p-5">
        <div className="w-48">
          <Input
            label="Máx. inasistencias (30 días)"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="font-mono tabular-nums"
          />
        </div>
        <Button type="button" onClick={guardar} loading={isPending}>
          Guardar
        </Button>
      </div>
    </section>
  );
}
