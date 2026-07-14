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
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <LuSnowflake className="h-4 w-4 text-warning" />
        Solicitudes de congelación
      </h3>
      <ul className="mt-3 space-y-2">
        {solicitudes.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
          >
            <span className="text-sm text-text-primary">
              {formatFecha(s.fecha_inicio)} — {formatFecha(s.fecha_fin)}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  resolver(
                    () => aprobarCongelacionAction(miembroId, s.id),
                    "Congelación aprobada"
                  )
                }
                title="Aprobar"
                className="rounded-lg border border-brand-green/40 p-1.5 text-brand-green hover:bg-brand-green/10 disabled:opacity-50"
              >
                <LuCheck className="h-3.5 w-3.5" />
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
                title="Rechazar"
                className="rounded-lg border border-border p-1.5 text-text-secondary hover:text-danger disabled:opacity-50"
              >
                <LuX className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
