"use client";

import { useState } from "react";
import { LuPlus, LuMegaphone } from "react-icons/lu";
import { AUDIENCIAS } from "@/lib/validations/campanas.schema";
import type { Campana } from "@/lib/queries/campanas.queries";
import { CampanaWizard, type AudienciaData } from "./CampanaWizard";

const AUD_LABEL = new Map(AUDIENCIAS.map((a) => [a.value, a.label]));

function fecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function CampanasManager({
  audiencias,
  campanas,
}: {
  audiencias: AudienciaData[];
  campanas: Campana[];
}) {
  const [creando, setCreando] = useState(false);

  return (
    <div className="space-y-6">
      {!creando && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
          >
            <LuPlus className="h-4 w-4" /> Nueva campaña
          </button>
        </div>
      )}

      {creando && (
        <CampanaWizard
          audiencias={audiencias}
          onDone={() => setCreando(false)}
        />
      )}

      {/* Historial */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-text-primary">
          Historial de campañas
        </h3>
        {campanas.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-4 py-12 text-center">
            <LuMegaphone className="h-8 w-8 text-text-muted" />
            <p className="mt-2 text-sm text-text-secondary">
              Aún no has enviado campañas.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {campanas.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {c.nombre}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {AUD_LABEL.get(c.audiencia) ?? c.audiencia} ·{" "}
                    {c.total_destinatarios} destinatario
                    {c.total_destinatarios === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="text-xs text-text-muted">
                  {fecha(c.enviada_at ?? c.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
