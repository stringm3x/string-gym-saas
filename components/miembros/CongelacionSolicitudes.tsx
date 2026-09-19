"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuSnowflake, LuCheck, LuX } from "react-icons/lu";
import { useToast } from "@/components/ui/Toast";
import { formatFecha } from "@/lib/utils/format";
import {
  aprobarCongelacionAction,
  rechazarCongelacionAction,
} from "@/app/(tenant)/[slug]/miembros/[id]/membresia-actions";

interface Solicitud {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  descripcion: string | null;
}

/** Solicitudes de congelación desde el portal: tarjeta con borde warning,
 * fechas en mono y dos botones de 44px por fila. */
export function CongelacionSolicitudes({
  miembroId,
  solicitudes,
}: {
  miembroId: string;
  solicitudes: Solicitud[];
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [pending, start] = useTransition();

  if (solicitudes.length === 0) return null;

  function resolver(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        toastError("Error", r.error ?? "No se pudo procesar.");
        return;
      }
      success(msg);
      router.refresh();
    });
  }

  return (
    <section className="border border-warning/40 bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="flex items-center gap-2 text-base font-semibold text-text-primary">
          <LuSnowflake className="h-4 w-4 text-warning" aria-hidden="true" />
          Solicitudes de congelación
        </h3>
        <span className="font-mono text-etiqueta text-text-muted">
          {solicitudes.length}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {solicitudes.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-4 px-5 py-2"
          >
            <div className="min-w-0">
              <p className="font-mono text-dato tabular-nums text-text-primary">
                {formatFecha(s.fecha_inicio)} — {formatFecha(s.fecha_fin)}
              </p>
              {s.descripcion && (
                <p className="truncate text-sm text-text-muted">
                  {s.descripcion}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  resolver(
                    () => aprobarCongelacionAction(miembroId, s.id),
                    "Congelación aprobada"
                  )
                }
                aria-label="Aprobar congelación"
                title="Aprobar"
                className="flex h-11 w-11 items-center justify-center border border-border text-text-primary transition-colors hover:border-brand-green hover:text-brand-green disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LuCheck className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  resolver(
                    () => rechazarCongelacionAction(miembroId, s.id),
                    "Solicitud rechazada"
                  )
                }
                aria-label="Rechazar congelación"
                title="Rechazar"
                className="flex h-11 w-11 items-center justify-center border border-border text-text-secondary transition-colors hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LuX className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
