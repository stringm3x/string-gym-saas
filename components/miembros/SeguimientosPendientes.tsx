"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LuCheck } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { toggleNotaCompletadaAction } from "@/app/(tenant)/[slug]/notas/actions";
import type { NotaSeguimiento } from "@/lib/queries/notas.queries";
import { formatFecha } from "@/lib/utils/format";
import { hoyISO } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

/** Seguimientos con fecha: tarjeta con borde warning (sin fondo lleno),
 * filas de 44px con la fecha en mono y el botón "Hecho". */
export function SeguimientosPendientes({
  pendientes,
  slug,
}: {
  pendientes: NotaSeguimiento[];
  slug: string;
}) {
  if (pendientes.length === 0) return null;

  return (
    <section className="border border-warning/40 bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="font-mono text-etiqueta uppercase text-warning">
          Seguimientos pendientes
        </h3>
        <span className="font-mono text-etiqueta text-text-muted">
          {pendientes.length}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {pendientes.map((n) => (
          <SeguimientoRow key={n.id} nota={n} slug={slug} />
        ))}
      </ul>
    </section>
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
    <li className="flex items-center justify-between gap-4 px-5 py-3">
      <div className="flex min-w-0 items-center gap-4">
        <span
          className={cn(
            "w-[76px] shrink-0 font-mono text-dato tabular-nums",
            vencida ? "text-danger" : "text-text-secondary"
          )}
        >
          {formatFecha(nota.fecha_seguimiento!)}
        </span>
        <div className="min-w-0">
          <Link
            href={`/${slug}/miembros/${nota.entidad_id}`}
            className="text-[15px] leading-5 text-text-primary underline-offset-4 hover:text-brand-green hover:underline"
          >
            {nota.miembro_nombre ?? "Miembro"}
          </Link>
          <p className="truncate text-sm text-text-muted">{nota.contenido}</p>
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={marcarHecho}
        loading={isPending}
        leftIcon={<LuCheck className="h-4 w-4" />}
      >
        Hecho
      </Button>
    </li>
  );
}
