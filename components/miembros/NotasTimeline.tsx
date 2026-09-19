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
  llamada: <LuPhone className="h-3.5 w-3.5" aria-hidden="true" />,
  whatsapp: <LuMessageCircle className="h-3.5 w-3.5" aria-hidden="true" />,
  email: <LuMail className="h-3.5 w-3.5" aria-hidden="true" />,
  visita: <LuStickyNote className="h-3.5 w-3.5" aria-hidden="true" />,
  otro: <LuStickyNote className="h-3.5 w-3.5" aria-hidden="true" />,
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
      <h3 className="text-base font-semibold text-text-primary">
        {eventos.length > 0 ? "Notas y actividad" : "Notas"}
      </h3>

      {legacyNotas && (
        <div className="border border-border bg-bg p-4">
          <p className="mb-1 font-mono text-etiqueta uppercase text-text-muted">
            Notas anteriores
          </p>
          <p className="whitespace-pre-wrap text-sm text-text-secondary">
            {legacyNotas}
          </p>
        </div>
      )}

      <form action={formAction} className="space-y-3">
        <textarea
          ref={textareaRef}
          name="contenido"
          rows={3}
          placeholder="Escribe una nota…"
          aria-label="Nueva nota"
          className="w-full rounded border border-border bg-bg px-3 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
          required
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <LuCalendarClock className="h-4 w-4" aria-hidden="true" />
            Recordar el
            <input
              ref={fechaRef}
              type="date"
              name="fecha_seguimiento"
              min={hoyISO()}
              className="h-11 rounded border border-border bg-bg px-3 font-mono text-sm text-text-primary focus:border-brand-green focus:outline-none"
            />
          </label>
          <Button
            type="submit"
            variant="secondary"
            leftIcon={<LuPencilLine className="h-4 w-4" />}
            loading={isPending}
          >
            Agregar nota
          </Button>
        </div>
      </form>

      {isEmpty ? (
        <p className="border border-border px-5 py-8 text-center text-sm text-text-muted">
          Sin notas todavía.
        </p>
      ) : (
        <ul className="divide-y divide-border border border-border">
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
    <li className="flex items-start gap-4 px-5 py-4">
      <span className="mt-0.5 shrink-0 text-text-muted" aria-hidden="true">
        {evento.tipo === "congelacion" ? (
          <LuSnowflake className="h-4 w-4" />
        ) : (
          <LuArrowLeftRight className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-5 text-text-primary">
          {evento.descripcion}
        </p>
        {evento.tipo === "congelacion" &&
          evento.fecha_inicio &&
          evento.fecha_fin && (
            <p className="mt-0.5 font-mono text-dato text-text-secondary">
              {formatFecha(evento.fecha_inicio)} —{" "}
              {formatFecha(evento.fecha_fin)}
            </p>
          )}
        <p className="mt-0.5 text-sm text-text-muted">
          <span className="font-mono">{formatDateTime(evento.created_at)}</span>
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

  // El estado del seguimiento se lee en el color del chip, no en un fondo
  // de toda la fila.
  return (
    <li className="px-5 py-4">
      {nota.tipo_accion && (
        <p className="mb-1.5 flex items-center gap-1.5 font-mono text-etiqueta uppercase text-text-muted">
          {tipoIcono[nota.tipo_accion]}
          {nota.tipo_accion}
        </p>
      )}
      <p className="whitespace-pre-wrap text-[15px] leading-5 text-text-primary">
        {nota.contenido}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-dato text-text-muted">
          {formatDateTime(nota.created_at)}
        </p>
        {nota.fecha_seguimiento && (
          <button
            type="button"
            onClick={toggle}
            disabled={isPending}
            aria-pressed={nota.completada}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 border px-2.5 font-mono text-xs uppercase tracking-[0.12em] transition-colors duration-150 disabled:opacity-50",
              nota.completada
                ? "border-success/40 text-success hover:border-success"
                : vencida
                  ? "border-danger/40 text-danger hover:border-danger"
                  : "border-warning/40 text-warning hover:border-warning"
            )}
          >
            {nota.completada ? (
              <LuCheck className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <LuCalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {nota.completada
              ? "Hecho"
              : `Seguimiento ${formatFecha(nota.fecha_seguimiento)}`}
          </button>
        )}
      </div>
    </li>
  );
}
