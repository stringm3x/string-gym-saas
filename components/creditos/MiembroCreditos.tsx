"use client";

import { useState } from "react";
import { LuCreditCard, LuPlus } from "react-icons/lu";
import type { PlanPagoConCuotas } from "@/lib/types/creditos";
import { PlanPagoForm } from "./PlanPagoForm";
import { PlanPagoCard } from "./PlanPagoCard";

interface PlanMembresiaOpt {
  id: string;
  nombre: string;
  precio: number;
}

export function MiembroCreditos({
  miembroId,
  miembroNombre,
  planes,
  planesMembresia,
}: {
  miembroId: string;
  miembroNombre: string;
  planes: PlanPagoConCuotas[];
  planesMembresia: PlanMembresiaOpt[];
}) {
  const [creando, setCreando] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <LuCreditCard className="h-4 w-4 text-brand-green" />
          Créditos / Pagos a plazos
        </h3>
        {!creando && (
          <button
            type="button"
            onClick={() => setCreando(true)}
            disabled={planesMembresia.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            title={
              planesMembresia.length === 0
                ? "Crea un plan de membresía primero"
                : undefined
            }
          >
            <LuPlus className="h-3.5 w-3.5" /> Crear plan de pagos
          </button>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {creando && (
          <PlanPagoForm
            miembroId={miembroId}
            planesMembresia={planesMembresia}
            onDone={() => setCreando(false)}
          />
        )}

        {planes.length === 0 && !creando ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm text-text-secondary">
              Este miembro no tiene planes de pago a plazos.
            </p>
            {planesMembresia.length === 0 && (
              <p className="mt-1 text-xs text-text-muted">
                Crea primero un plan de membresía para poder ofrecer pagos a
                plazos.
              </p>
            )}
          </div>
        ) : (
          planes.map((p) => (
            <PlanPagoCard key={p.id} plan={p} miembroNombre={miembroNombre} />
          ))
        )}
      </div>
    </div>
  );
}
