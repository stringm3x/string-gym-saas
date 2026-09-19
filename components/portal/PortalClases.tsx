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

function fechaCorta(iso: string): string {
  return new Date(iso + "T00:00:00")
    .toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", month: "short" })
    .replace(/\./g, "");
}

/** Reservas del socio y clases disponibles, en filas de 56px para el pulgar. */
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

  const btnSecundario =
    "inline-flex h-11 shrink-0 items-center border border-border px-4 text-sm text-text-primary transition-colors hover:border-text-secondary disabled:opacity-50";
  const btnPrimario =
    "inline-flex h-11 shrink-0 items-center bg-brand-green px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-green/90 disabled:opacity-50";

  return (
    <div className="flex flex-col gap-4">
      {misReservas.length > 0 && (
        <section className="border border-border bg-surface">
          <p className="border-b border-border px-5 py-4 font-mono text-etiqueta uppercase text-text-secondary">
            Mis reservas
          </p>
          <ul className="divide-y divide-border">
            {misReservas.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] leading-5 text-text-primary">
                    {r.clase_nombre}
                  </p>
                  <p className="mt-0.5 font-mono text-etiqueta uppercase text-text-muted">
                    {fechaCorta(r.fecha)} · {r.hora_inicio.slice(0, 5)}
                    {r.estado === "en_lista_espera" && " · En espera"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending && busyId === r.sesion_id}
                  onClick={() => cancelar(r.id, r.sesion_id)}
                  className={btnSecundario}
                >
                  Cancelar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border border-border bg-surface">
        <p className="border-b border-border px-5 py-4 font-mono text-etiqueta uppercase text-text-secondary">
          Clases disponibles
        </p>
        {porFecha.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-text-muted">
            No hay clases programadas por ahora.
          </p>
        ) : (
          <div className="flex flex-col">
            {porFecha.map(([fecha, lista]) => (
              <div key={fecha}>
                <p className="bg-bg px-5 py-2 font-mono text-etiqueta uppercase text-text-muted">
                  {encabezadoFecha(fecha)}
                </p>
                <ul className="divide-y divide-border">
                  {lista.map((s) => {
                    const reserva = reservaPorSesion.get(s.id);
                    const lleno = s.cupo_disponible <= 0;
                    return (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-3 px-5 py-4"
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <span className="w-[52px] shrink-0 font-mono text-dato text-text-secondary">
                            {s.hora_inicio.slice(0, 5)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[15px] leading-5 text-text-primary">
                              {s.clase_nombre}
                            </p>
                            <p className="mt-0.5 text-sm text-text-muted">
                              {lleno
                                ? "Cupo lleno"
                                : `${s.cupo_disponible} de ${s.cupo_maximo} lugares`}
                            </p>
                          </div>
                        </div>
                        {reserva ? (
                          <button
                            type="button"
                            disabled={pending && busyId === s.id}
                            onClick={() => cancelar(reserva.id, s.id)}
                            className={`${btnSecundario} border-brand-green/50 text-brand-green hover:border-danger hover:text-danger`}
                          >
                            Cancelar
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={pending && busyId === s.id}
                            onClick={() => reservar(s.id)}
                            className={lleno ? btnSecundario : btnPrimario}
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
