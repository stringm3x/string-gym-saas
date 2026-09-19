"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuArrowLeft } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { formatDiaCorto, formatHora12 } from "@/lib/utils/clases-format";
import { cancelarSesionAction } from "@/app/(tenant)/[slug]/clases/[sesionId]/actions";
import { ReservaQuickForm } from "./ReservaQuickForm";
import { ReservasList } from "./ReservasList";
import { ListaEsperaPanel } from "./ListaEsperaPanel";
import type { ClaseSesion } from "@/lib/types/clases";

const ACTIVAS = ["confirmada", "asistio", "no_asistio"];

/** Detalle de una sesión: kicker con día y hora en mono, título en Geist,
 * cupo en mono; reservas y lista de espera en tarjetas con cabecera. */
export function SesionDetalle({
  sesion,
  slug,
  canGestionar,
}: {
  sesion: ClaseSesion;
  slug: string;
  canGestionar: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const reservas = sesion.reservas ?? [];
  const activas = reservas.filter((r) => ACTIVAS.includes(r.estado));
  const espera = reservas.filter((r) => r.estado === "en_lista_espera");
  const confirmadas = sesion.cupo_maximo - sesion.cupo_disponible;
  const cancelada = sesion.estado === "cancelada";
  const llena = !cancelada && sesion.cupo_disponible <= 0;

  function cancelarSesion() {
    if (!confirm("¿Cancelar esta sesión? Las reservas quedarán sin efecto."))
      return;
    start(async () => {
      await cancelarSesionAction(sesion.id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link
          href={`/${slug}/clases`}
          className="inline-flex h-9 items-center gap-1.5 self-start text-sm text-text-secondary underline-offset-4 hover:text-brand-green hover:underline"
        >
          <LuArrowLeft className="h-4 w-4" aria-hidden="true" /> Calendario
        </Link>

        <p className="font-mono text-etiqueta uppercase text-text-muted">
          {formatDiaCorto(sesion.fecha)} · {formatHora12(sesion.hora_inicio)} –{" "}
          {formatHora12(sesion.hora_fin)}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="flex items-center gap-3 text-pagina font-semibold text-text-primary">
            <span
              className="h-7 w-1.5 shrink-0"
              style={{ backgroundColor: sesion.clase?.color ?? "#10b981" }}
              aria-hidden="true"
            />
            {sesion.clase?.nombre ?? "Clase"}
          </h1>
          <span
            className={`font-mono text-dato tabular-nums ${
              cancelada
                ? "text-danger"
                : llena
                  ? "text-brand-green"
                  : "text-text-secondary"
            }`}
          >
            {cancelada
              ? "Cancelada"
              : `${confirmadas}/${sesion.cupo_maximo}${llena ? " · Llena" : ""}`}
          </span>
        </div>
        {sesion.clase?.instructor && (
          <p className="text-sm text-text-muted">{sesion.clase.instructor}</p>
        )}
      </div>

      {cancelada ? (
        <p className="border border-danger/40 px-4 py-3 text-sm text-danger">
          Esta sesión está cancelada.
        </p>
      ) : (
        <ReservaQuickForm sesionId={sesion.id} />
      )}

      <section className="card-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold text-text-primary">Reservas</h3>
          <span className="font-mono text-etiqueta text-text-muted">
            {activas.length}
          </span>
        </div>
        <ReservasList sesionId={sesion.id} reservas={activas} />
      </section>

      <ListaEsperaPanel sesionId={sesion.id} reservas={espera} />

      {canGestionar && !cancelada && (
        <div className="border-t border-border pt-4">
          <Button
            type="button"
            variant="secondary"
            loading={pending}
            onClick={cancelarSesion}
            className="border-danger/40 text-danger hover:border-danger"
          >
            Cancelar sesión
          </Button>
        </div>
      )}
    </div>
  );
}
