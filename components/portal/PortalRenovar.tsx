"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { money } from "@/lib/utils/creditos-calc";
import { renovarMpAction } from "@/app/portal/[slug]/renovar/actions";

interface PlanOpt {
  id: string;
  nombre: string;
  precio: number;
  dias_duracion: number;
}

export function PortalRenovar({
  slug,
  planes,
}: {
  slug: string;
  planes: PlanOpt[];
}) {
  const { error: toastError } = useToast();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function pagar(planId: string) {
    setBusyId(planId);
    start(async () => {
      const r = await renovarMpAction(slug, planId);
      if (!r.ok) {
        setBusyId(null);
        toastError("No se pudo iniciar el pago", r.error);
        return;
      }
      // Redirige al checkout de MercadoPago.
      window.location.href = r.initPoint;
    });
  }

  if (planes.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-text-secondary">
        Tu gimnasio aún no publicó planes para renovar en línea.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {planes.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-5"
        >
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {p.nombre}
            </p>
            <p className="text-xs text-text-secondary">
              {p.dias_duracion} días · {money(p.precio)}
            </p>
          </div>
          <button
            type="button"
            disabled={pending && busyId === p.id}
            onClick={() => pagar(p.id)}
            className="shrink-0 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending && busyId === p.id ? "Abriendo…" : "Pagar"}
          </button>
        </div>
      ))}
      <p className="text-center text-[11px] text-text-muted">
        Pago seguro con MercadoPago. Tu membresía se extiende automáticamente al
        confirmarse.
      </p>
    </div>
  );
}
