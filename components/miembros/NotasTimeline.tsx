"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LuPencilLine,
  LuStickyNote,
  LuPhone,
  LuMessageCircle,
  LuMail,
  LuCalendarClock,
  LuCheck,
  LuSnowflake,
  LuArrowLeftRight,
} from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  createNotaAction,
  toggleNotaCompletadaAction,
  type NotaFormState,
} from "@/app/(tenant)/[slug]/notas/actions";
import type { Nota, TipoAccion } from "@/lib/queries/notas.queries";
import type { EventoMiembro } from "@/lib/queries/miembro-eventos.queries";
import { TZ_MX, hoyISO } from "@/lib/utils/dates";
import { formatFecha } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const initialState: NotaFormState = { ok: false, error: null };

const tipoIcono: Record<TipoAccion, React.ReactNode> = {
  llamada: <LuPhone className="h-3 w-3" />,
  whatsapp: <LuMessageCircle className="h-3 w-3" />,
  email: <LuMail className="h-3 w-3" />,
  visita: <LuStickyNote className="h-3 w-3" />,
  otro: <LuStickyNote className="h-3 w-3" />,
};

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("es-MX", {
    timeZone: TZ_MX,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface NotasTimelineProps {
  entidadTipo: "miembro" | "prospecto";
  entidadId: string;
  notas: Nota[];
  legacyNotas?: string | null;
  /** Eventos de membresía (congelación/cambio de plan) a fusionar en el
   * mismo timeline cronológico — un solo feed en vez de dos separados. */
  eventos?: EventoMiembro[];
}

type Entrada =
  | { kind: "nota"; fecha: string; nota: Nota }
  | { kind: "evento"; fecha: string; evento: EventoMiembro };

export function NotasTimeline({
  entidadTipo,
  entidadId,
  notas,
  legacyNotas,
  eventos = [],
}: NotasTimelineProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fechaRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState(
    createNotaAction.bind(null, entidadTipo, entidadId),
    initialState
  );

  useEffect(() => {
    if (state.ok) {
      success("Nota guardada");
      if (textareaRef.current) textareaRef.current.value = "";
      if (fechaRef.current) fechaRef.current.value = "";
      router.refresh();
    } else if (state.error) {
      toastError("Error", state.error);
    }
  }, [state]);

  const isEmpty = notas.length === 0 && eventos.length === 0 && !legacyNotas;

  const entradas: Entrada[] = [
    ...notas.map((n) => ({ kind: "nota" as const, fecha: n.created_at, nota: n })),
    ...eventos.map((e) => ({
      kind: "evento" as const,
      fecha: e.created_at,
      evento: e,
    })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text-primary">
        {eventos.length > 0 ? "Notas y actividad" : "Notas"}
      </h3>

      {legacyNotas && (
        <div className="rounded-lg border border-border bg-surface-hover p-3">
          <p className="mb-1 text-xs font-medium text-text-muted">
            Notas anteriores
          </p>
          <p className="whitespace-pre-wrap text-sm text-text-secondary">
            {legacyNotas}
          </p>
        </div>
      )}

      <form action={formAction} className="space-y-2">
        <textarea
          ref={textareaRef}
          name="contenido"
          rows={3}
          placeholder="Escribe una nota…"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
          required
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-xs text-text-secondary">
            <LuCalendarClock className="h-3.5 w-3.5" />
            Recordar el
            <input
              ref={fechaRef}
              type="date"
              name="fecha_seguimiento"
              min={hoyISO()}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text-primary focus:border-brand-green focus:outline-none"
            />
          </label>
          <Button
            type="submit"
            leftIcon={<LuPencilLine className="h-3.5 w-3.5" />}
            loading={isPending}
          >
            Agregar nota
          </Button>
        </div>
      </form>

      {isEmpty ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-6">
          <LuStickyNote className="h-4 w-4 text-text-muted" />
          <p className="text-sm text-text-muted">Sin notas aún</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {entradas.map((e) =>
            e.kind === "nota" ? (
              <NotaItem key={`nota-${e.nota.id}`} nota={e.nota} />
            ) : (
              <EventoItem key={`evento-${e.evento.id}`} evento={e.evento} />
            )
          )}
        </ul>
      )}
    </div>
  );
}

function EventoItem({ evento }: { evento: EventoMiembro }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg text-text-secondary">
        {evento.tipo === "congelacion" ? (
          <LuSnowflake className="h-3.5 w-3.5" />
        ) : (
          <LuArrowLeftRight className="h-3.5 w-3.5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text-primary">{evento.descripcion}</p>
        {evento.tipo === "congelacion" &&
          evento.fecha_inicio &&
          evento.fecha_fin && (
            <p className="text-[11px] text-text-muted">
              {formatFecha(evento.fecha_inicio)} —{" "}
              {formatFecha(evento.fecha_fin)}
            </p>
          )}
        <p className="text-[11px] text-text-muted">
          {formatDateTime(evento.created_at)}
          {evento.creado_por_nombre && ` · ${evento.creado_por_nombre}`}
        </p>
      </div>
    </li>
  );
}

function NotaItem({ nota }: { nota: Nota }) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [isPending, startTransition] = useTransition();

  const pendiente = !!nota.fecha_seguimiento && !nota.completada;
  const vencida = pendiente && nota.fecha_seguimiento! < hoyISO();

  function toggle() {
    startTransition(async () => {
      const r = await toggleNotaCompletadaAction(nota.id, !nota.completada);
      if (!r.ok) {
        toastError("No se pudo actualizar", r.error);
        return;
      }
      success(nota.completada ? "Marcada como pendiente" : "Seguimiento hecho");
      router.refresh();
    });
  }

  return (
    <li
      className={cn(
        "rounded-lg border p-3",
        vencida
          ? "border-danger/30 bg-danger/5"
          : pendiente
            ? "border-warning/30 bg-warning/5"
            : "border-border bg-surface"
      )}
    >
      {nota.tipo_accion && (
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-muted capitalize">
          {tipoIcono[nota.tipo_accion]}
          {nota.tipo_accion}
        </div>
      )}
      <p className="whitespace-pre-wrap text-sm text-text-primary">
        {nota.contenido}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-muted">
          {formatDateTime(nota.created_at)}
        </p>
        {nota.fecha_seguimiento && (
          <button
            type="button"
            onClick={toggle}
            disabled={isPending}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors duration-150 disabled:opacity-50",
              nota.completada
                ? "border-success/30 bg-success/10 text-success"
                : vencida
                  ? "border-danger/30 bg-danger/10 text-danger hover:bg-danger/20"
                  : "border-warning/30 bg-warning/10 text-warning hover:bg-warning/20"
            )}
          >
            {nota.completada ? (
              <LuCheck className="h-3 w-3" />
            ) : (
              <LuCalendarClock className="h-3 w-3" />
            )}
            {nota.completada
              ? "Seguimiento hecho"
              : `Seguimiento: ${formatFecha(nota.fecha_seguimiento)}`}
          </button>
        )}
      </div>
    </li>
  );
}
