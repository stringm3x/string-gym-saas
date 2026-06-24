"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuArrowLeft } from "react-icons/lu";
import { formatDiaCorto, formatHora12 } from "@/lib/utils/clases-format";
import { cancelarSesionAction } from "@/app/(tenant)/[slug]/clases/[sesionId]/actions";
import { ReservaQuickForm } from "./ReservaQuickForm";
import { ReservasList } from "./ReservasList";
import { ListaEsperaPanel } from "./ListaEsperaPanel";
import type { ClaseSesion } from "@/lib/types/clases";

const ACTIVAS = ["confirmada", "asistio", "no_asistio"];

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

  function cancelarSesion() {
    if (!confirm("¿Cancelar esta sesión? Las reservas quedarán sin efecto."))
      return;
    start(async () => {
      await cancelarSesionAction(sesion.id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <Link
        href={`/${slug}/clases`}
        className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary"
      >
        <LuArrowLeft className="h-3.5 w-3.5" /> Calendario
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3">
        <span
          className="mt-1 h-10 w-1.5 rounded-full"
          style={{ backgroundColor: sesion.clase?.color ?? "#10b981" }}
        />
        <div>
          <h1 className="text-xl font-semibold text-text-primary">
            {sesion.clase?.nombre ?? "Clase"}
          </h1>
          <p className="text-sm text-text-secondary">
            {formatDiaCorto(sesion.fecha)} · {formatHora12(sesion.hora_inicio)} –{" "}
            {formatHora12(sesion.hora_fin)}
            {sesion.clase?.instructor && ` · ${sesion.clase.instructor}`}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {confirmadas}/{sesion.cupo_maximo} confirmados
            {sesion.cupo_disponible <= 0 && !cancelada && (
              <span className="ml-1 text-warning">· Completo</span>
            )}
          </p>
        </div>
      </div>

      {cancelada ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Esta sesión está cancelada.
        </div>
      ) : (
        <ReservaQuickForm sesionId={sesion.id} />
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">
          Reservas ({activas.length})
        </h3>
        <ReservasList sesionId={sesion.id} reservas={activas} />
      </div>

      <ListaEsperaPanel sesionId={sesion.id} reservas={espera} />

      {canGestionar && !cancelada && (
        <div className="border-t border-border pt-4">
          <button
            type="button"
            disabled={pending}
            onClick={cancelarSesion}
            className="rounded-lg border border-danger/40 px-3 py-2 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
          >
            Cancelar sesión
          </button>
        </div>
      )}
    </div>
  );
}
