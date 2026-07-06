"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
  reservarClasePortalAction,
  cancelarReservaPortalAction,
} from "@/app/portal/[slug]/clases/actions";
import type { ReservaPortal } from "@/lib/queries/portal.queries";

export interface SesionRow {
  id: string;
  fecha: string;
  hora_inicio: string;
  cupo_maximo: number;
  cupo_disponible: number;
  clase_nombre: string;
}

function encabezadoFecha(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-MX", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function PortalClases({
  slug,
  sesiones,
  misReservas,
}: {
  slug: string;
  sesiones: SesionRow[];
  misReservas: ReservaPortal[];
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const reservaPorSesion = useMemo(
    () => new Map(misReservas.map((r) => [r.sesion_id, r])),
    [misReservas]
  );

  const porFecha = useMemo(() => {
    const map = new Map<string, SesionRow[]>();
    for (const s of sesiones) {
      const arr = map.get(s.fecha) ?? [];
      arr.push(s);
      map.set(s.fecha, arr);
    }
    return [...map.entries()];
  }, [sesiones]);

  function reservar(sesionId: string) {
    setBusyId(sesionId);
    start(async () => {
      const r = await reservarClasePortalAction(slug, sesionId);
      setBusyId(null);
      if (!r.ok) {
        toastError("No se pudo reservar", r.error);
        return;
      }
      success(r.enListaEspera ? "Te anotamos en la lista de espera" : "Clase reservada");
      router.refresh();
    });
  }

  function cancelar(reservaId: string, sesionId: string) {
    setBusyId(sesionId);
    start(async () => {
      const r = await cancelarReservaPortalAction(slug, reservaId, sesionId);
      setBusyId(null);
      if (!r.ok) {
        toastError("No se pudo cancelar", r.error);
        return;
      }
      success("Reserva cancelada");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {misReservas.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-text-primary">
            Mis reservas
          </h2>
          <ul className="mt-3 space-y-2">
            {misReservas.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {r.clase_nombre}
                    {r.estado === "en_lista_espera" && (
                      <span className="ml-2 rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[9px] font-medium text-warning">
                        En espera
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {encabezadoFecha(r.fecha)} · {r.hora_inicio.slice(0, 5)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending && busyId === r.sesion_id}
                  onClick={() => cancelar(r.id, r.sesion_id)}
                  className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:text-danger disabled:opacity-50"
                >
                  Cancelar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-text-primary">
          Clases disponibles
        </h2>
        {porFecha.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">
            No hay clases programadas por ahora.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {porFecha.map(([fecha, lista]) => (
              <div key={fecha}>
                <p className="mb-1.5 text-xs font-medium capitalize text-text-muted">
                  {encabezadoFecha(fecha)}
                </p>
                <ul className="space-y-2">
                  {lista.map((s) => {
                    const reserva = reservaPorSesion.get(s.id);
                    const lleno = s.cupo_disponible <= 0;
                    return (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {s.clase_nombre}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {s.hora_inicio.slice(0, 5)} ·{" "}
                            {lleno
                              ? "Cupo lleno"
                              : `${s.cupo_disponible}/${s.cupo_maximo} lugares`}
                          </p>
                        </div>
                        {reserva ? (
                          <button
                            type="button"
                            disabled={pending && busyId === s.id}
                            onClick={() => cancelar(reserva.id, s.id)}
                            className="shrink-0 rounded-lg border border-brand-green/40 px-3 py-1.5 text-xs font-medium text-brand-green transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
                          >
                            Reservada · Cancelar
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={pending && busyId === s.id}
                            onClick={() => reservar(s.id)}
                            className="shrink-0 rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            {lleno ? "Lista de espera" : "Reservar"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
