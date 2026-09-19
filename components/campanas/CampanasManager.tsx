"use client";

import { useState } from "react";
import { LuPlus, LuMegaphone } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AUDIENCIAS } from "@/lib/validations/campanas.schema";
import type { Campana } from "@/lib/queries/campanas.queries";
import { CampanaWizard, type AudienciaData } from "./CampanaWizard";
import { TZ_MX } from "@/lib/utils/dates";

const AUD_LABEL = new Map(AUDIENCIAS.map((a) => [a.value, a.label]));

function fecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    timeZone: TZ_MX,
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
          <Button
            type="button"
            leftIcon={<LuPlus className="h-4 w-4" />}
            onClick={() => setCreando(true)}
          >
            Nueva campaña
          </Button>
        </div>
      )}

      {creando && (
        <CampanaWizard
          audiencias={audiencias}
          onDone={() => setCreando(false)}
        />
      )}

      {/* Historial */}
      <section className="border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold text-text-primary">
            Historial de campañas
          </h3>
          <span className="font-mono text-etiqueta text-text-muted">
            {campanas.length}
          </span>
        </div>
        {campanas.length === 0 ? (
          <EmptyState
            icon={<LuMegaphone />}
            title="Sin campañas todavía"
            description="Manda un mensaje de WhatsApp a un grupo de miembros de una sola vez: activos, por vencer, vencidos o sin actividad."
            action={
              !creando ? (
                <Button
                  type="button"
                  leftIcon={<LuPlus className="h-4 w-4" />}
                  onClick={() => setCreando(true)}
                >
                  Crear primera campaña
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {campanas.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {c.nombre}
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {AUD_LABEL.get(c.audiencia) ?? c.audiencia} ·{" "}
                    <span className="font-mono tabular-nums">
                      {c.total_destinatarios}
                    </span>{" "}
                    destinatario{c.total_destinatarios === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="font-mono text-dato tabular-nums text-text-muted">
                  {fecha(c.enviada_at ?? c.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
