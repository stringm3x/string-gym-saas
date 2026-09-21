"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuPlus, LuMegaphone, LuExternalLink, LuX } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { AUDIENCIAS } from "@/lib/validations/campanas.schema";
import type { Campana, Destinatario } from "@/lib/queries/campanas.queries";
import { CampanaWizard, type AudienciaData } from "./CampanaWizard";
import { TZ_MX } from "@/lib/utils/dates";
import { buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import { compilarPlantilla } from "@/lib/utils/plantilla";
import {
  reabrirCampanaManualAction,
  marcarCampanaEnviadaManualAction,
} from "@/app/(tenant)/[slug]/comunicaciones/campanas/actions";

const AUD_LABEL = new Map(AUDIENCIAS.map((a) => [a.value, a.label]));

function renderMensaje(msg: string, d: Destinatario): string {
  const venc = d.fecha_vencimiento
    ? new Date(d.fecha_vencimiento + "T00:00:00").toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "long",
      })
    : "";
  return compilarPlantilla(msg, { nombre: d.nombre, fecha_vencimiento: venc });
}

/**
 * Reabre los links wa.me de una campaña manual ya creada — recalculados en
 * el momento, sin crear ninguna fila nueva. Antes "rehacer" significaba
 * pasar todo el wizard de nuevo, que sí duplicaba la campaña en el
 * historial.
 */
function CampanaLinksModal({
  campana,
  onClose,
}: {
  campana: Campana;
  onClose: () => void;
}) {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [pending, start] = useTransition();
  const [confirmando, startConfirmar] = useTransition();
  const [destinatarios, setDestinatarios] = useState<Destinatario[] | null>(null);

  useEffect(() => {
    start(async () => {
      const r = await reabrirCampanaManualAction(campana.id);
      if (!r.ok) {
        toastError("No se pudieron recalcular los links", r.error);
        onClose();
        return;
      }
      setDestinatarios(r.destinatarios);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campana.id]);

  function confirmar() {
    startConfirmar(async () => {
      await marcarCampanaEnviadaManualAction(campana.id);
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campana-links-titulo"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-bg/70"
      />
      <div className="relative flex max-h-[85vh] w-full max-w-md flex-col border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h4 id="campana-links-titulo" className="text-base font-semibold text-text-primary">
            {campana.nombre}
          </h4>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <LuX className="h-4 w-4 text-text-muted" />
          </button>
        </div>
        {pending || !destinatarios ? (
          <p className="px-5 py-8 text-center text-sm text-text-muted">
            Calculando destinatarios…
          </p>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-border overflow-y-auto">
              {destinatarios.map((d) => (
                <li key={d.id}>
                  <a
                    href={buildWhatsAppUrl(d.telefono, renderMensaje(campana.mensaje, d))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-11 items-center justify-between gap-3 px-5 text-sm transition-colors hover:bg-surface-hover"
                  >
                    <span className="truncate text-text-primary">{d.nombre}</span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-dato tabular-nums text-brand-green">
                      {d.telefono}
                      <LuExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cerrar
              </Button>
              {!campana.enviada_at && (
                <Button type="button" loading={confirmando} onClick={confirmar}>
                  Marcar como enviada
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

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
  const [viendoLinks, setViendoLinks] = useState<Campana | null>(null);

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
          <EmptyState ilustracion="telefono"
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
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-text-primary">
                    {c.nombre}
                    {c.canal === "api" && <Badge variant="success">API</Badge>}
                    {c.canal === "manual" && <Badge variant="neutral">Manual</Badge>}
                    {!c.enviada_at && <Badge variant="warning">Pendiente</Badge>}
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {AUD_LABEL.get(c.audiencia) ?? c.audiencia} ·{" "}
                    <span className="font-mono tabular-nums">
                      {c.total_destinatarios}
                    </span>{" "}
                    destinatario{c.total_destinatarios === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-dato tabular-nums text-text-muted">
                    {fecha(c.enviada_at ?? c.created_at)}
                  </span>
                  {c.canal !== "api" && (
                    <button
                      type="button"
                      onClick={() => setViendoLinks(c)}
                      className="text-xs text-brand-green underline-offset-4 hover:underline"
                    >
                      Ver links
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {viendoLinks && (
        <CampanaLinksModal
          campana={viendoLinks}
          onClose={() => setViendoLinks(null)}
        />
      )}
    </div>
  );
}
