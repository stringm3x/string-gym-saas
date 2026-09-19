"use client";

import { useEffect, useRef } from "react";
import type {
  MensajeInbox,
  MiembroResumenInbox,
} from "@/lib/queries/inbox.queries";
import { cn } from "@/lib/utils/cn";

const TZ = "America/Mexico_City";

function diaDe(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(iso));
}

function etiquetaDia(iso: string): string {
  const hoy = diaDe(new Date().toISOString());
  const ayer = diaDe(new Date(Date.now() - 86400000).toISOString());
  const d = diaDe(iso);
  if (d === hoy) return "Hoy";
  if (d === ayer) return "Ayer";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    timeZone: TZ,
  }).format(new Date(iso));
}

function hora(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(iso));
}

interface HiloMensajesProps {
  titulo: string;
  miembro: MiembroResumenInbox | null;
  mensajes: MensajeInbox[];
}

export function HiloMensajes({ titulo, miembro, mensajes }: HiloMensajesProps) {
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Encabezado */}
      <div className="border-b border-border px-5 py-4">
        <h3 className="truncate text-base font-semibold text-text-primary">
          {titulo}
        </h3>
        {miembro ? (
          <p className="mt-0.5 text-xs text-text-secondary">
            {miembro.plan_nombre ?? "Sin plan"}
            {" · "}
            <span
              className={cn(
                "font-mono uppercase tracking-[0.12em]",
                miembro.vigente ? "text-brand-green" : "text-danger"
              )}
            >
              {miembro.vigente ? "Activa" : "Vencida"}
            </span>
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-text-muted">Contacto no vinculado</p>
        )}
      </div>

      {/* Mensajes */}
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {mensajes.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            Sin mensajes en esta conversación.
          </p>
        ) : (
          mensajes.map((m, i) => {
            const nuevoDia =
              i === 0 || diaDe(m.enviado_at) !== diaDe(mensajes[i - 1].enviado_at);
            return (
              <div key={m.id}>
                {nuevoDia && (
                  <div className="my-4 flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" aria-hidden="true" />
                    <span className="font-mono text-etiqueta uppercase text-text-muted">
                      {etiquetaDia(m.enviado_at)}
                    </span>
                    <span className="h-px flex-1 bg-border" aria-hidden="true" />
                  </div>
                )}
                <Burbuja mensaje={m} />
              </div>
            );
          })
        )}
        <div ref={finRef} />
      </div>
    </div>
  );
}

function Burbuja({ mensaje }: { mensaje: MensajeInbox }) {
  const entrante = mensaje.direccion === "entrante";

  // Estilo por dirección/tipo. Los tokens bubble-bot / bubble-auto se
  // conservan; el radio se queda en `rounded` (4px), el máximo del sistema.
  let estilo = "border border-border bg-bg text-text-primary"; // entrante
  let tsColor = "text-text-muted";
  let badge: string | null = null;
  if (!entrante) {
    if (mensaje.tipo === "bot") {
      estilo = "bg-bubble-bot text-text-primary";
      tsColor = "text-text-primary/60";
      badge = "Bot";
    } else if (mensaje.tipo === "template") {
      estilo = "bg-bubble-auto text-text-primary";
      tsColor = "text-text-primary/60";
      badge = "Auto";
    } else {
      estilo = "bg-brand-green text-on-brand"; // manual (verde marca)
      tsColor = "text-on-brand/60";
    }
  }

  return (
    <div className={cn("flex", entrante ? "justify-start" : "justify-end")}>
      <div className={cn("max-w-[80%] rounded px-3 py-2 text-sm", estilo)}>
        {badge && (
          <span className="mb-1 inline-block border border-text-primary/20 px-1.5 py-0.5 font-mono text-xs uppercase tracking-[0.12em]">
            {badge}
          </span>
        )}
        <p className="whitespace-pre-wrap break-words">{mensaje.contenido}</p>
        <p
          className={cn(
            "mt-1 text-right font-mono text-xs tabular-nums",
            tsColor
          )}
        >
          {hora(mensaje.enviado_at)}
        </p>
      </div>
    </div>
  );
}
