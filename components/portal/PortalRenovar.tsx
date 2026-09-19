"use client";

import { useState, useTransition } from "react";
import { LuCreditCard } from "react-icons/lu";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
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
      <EmptyState
        icon={<LuCreditCard />}
        title="Renueva en recepción"
        description="Tu gimnasio todavía no publica planes para pagar en línea. En recepción te ayudan a renovar."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-border border border-border bg-surface">
        {planes.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-4 px-5 py-4"
          >
            <div className="min-w-0">
              <p className="truncate text-[15px] leading-5 text-text-primary">
                {p.nombre}
              </p>
              <p className="mt-0.5 font-mono text-etiqueta uppercase text-text-muted">
                {p.dias_duracion} días · {money(p.precio)}
              </p>
            </div>
            <button
              type="button"
              disabled={pending && busyId === p.id}
              onClick={() => pagar(p.id)}
              className="inline-flex h-11 shrink-0 items-center bg-brand-green px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-green/90 disabled:opacity-50"
            >
              {pending && busyId === p.id ? "Abriendo…" : "Pagar"}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-center text-sm text-text-muted">
        Pago seguro con MercadoPago. Tu membresía se extiende sola al
        confirmarse.
      </p>
    </div>
  );
}
