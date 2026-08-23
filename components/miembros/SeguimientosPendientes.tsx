"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LuCalendarClock, LuCheck } from "react-icons/lu";
import { useToast } from "@/components/ui/Toast";
import { toggleNotaCompletadaAction } from "@/app/(tenant)/[slug]/notas/actions";
import type { NotaSeguimiento } from "@/lib/queries/notas.queries";
import { formatFecha } from "@/lib/utils/format";
import { hoyISO } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

export function SeguimientosPendientes({
  pendientes,
  slug,
}: {
  pendientes: NotaSeguimiento[];
  slug: string;
}) {
  if (pendientes.length === 0) return null;

  return (
    <div className="space-y-2 rounded-xl border border-warning/40 bg-warning/[0.06] p-4">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warning">
        <LuCalendarClock className="h-3.5 w-3.5" />
        Seguimientos pendientes ({pendientes.length})
      </h3>
      <ul className="space-y-1.5">
        {pendientes.map((n) => (
          <SeguimientoRow key={n.id} nota={n} slug={slug} />
        ))}
      </ul>
    </div>
  );
}

function SeguimientoRow({
  nota,
  slug,
}: {
  nota: NotaSeguimiento;
  slug: string;
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isPending, startTransition] = useTransition();
  const vencida = nota.fecha_seguimiento! < hoyISO();

  function marcarHecho() {
    startTransition(async () => {
      const r = await toggleNotaCompletadaAction(nota.id, true);
      if (!r.ok) {
        toastError("No se pudo actualizar", r.error);
        return;
      }
      success("Seguimiento hecho");
      router.refresh();
    });
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
      <div className="min-w-0">
        <Link
          href={`/${slug}/miembros/${nota.entidad_id}`}
          className="font-medium text-text-primary transition-colors hover:text-brand-green"
        >
          {nota.miembro_nombre ?? "Miembro"}
        </Link>
        <p className="truncate text-xs text-text-secondary">
          {nota.contenido}
        </p>
        <p
          className={cn(
            "text-[11px]",
            vencida ? "text-danger" : "text-text-muted"
          )}
        >
          {vencida ? "Venció" : "Programado"}:{" "}
          {formatFecha(nota.fecha_seguimiento!)}
        </p>
      </div>
      <button
        type="button"
        onClick={marcarHecho}
        disabled={isPending}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:border-success/40 hover:text-success disabled:opacity-50"
      >
        <LuCheck className="h-3.5 w-3.5" /> Hecho
      </button>
    </li>
  );
}
