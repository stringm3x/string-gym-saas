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
      <div className="border-b border-border px-4 py-3">
        <h3 className="truncate text-sm font-semibold text-text-primary">
          {titulo}
        </h3>
        {miembro ? (
          <p className="mt-0.5 text-xs text-text-secondary">
            {miembro.plan_nombre ?? "Sin plan"}
            {" · "}
            <span
              className={cn(
                "font-medium",
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
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-medium text-text-muted">
                      {etiquetaDia(m.enviado_at)}
                    </span>
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

  // Estilo por dirección/tipo.
  let estilo = "bg-surface text-text-primary"; // entrante (gris)
  let tsColor = "text-text-muted";
  let badge: string | null = null;
  if (!entrante) {
    if (mensaje.tipo === "bot") {
      estilo = "bg-[#166534] text-white"; // verde oscuro
      tsColor = "text-white/60";
      badge = "Bot";
    } else if (mensaje.tipo === "template") {
      estilo = "bg-[#1e3a8a] text-white"; // azul oscuro
      tsColor = "text-white/60";
      badge = "Auto";
    } else {
      estilo = "bg-brand-green text-bg"; // manual (verde marca)
      tsColor = "text-bg/60";
    }
  }

  return (
    <div className={cn("flex", entrante ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
          estilo,
          entrante ? "rounded-bl-sm" : "rounded-br-sm"
        )}
      >
        {badge && (
          <span className="mb-1 inline-block rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            {badge}
          </span>
        )}
        <p className="whitespace-pre-wrap break-words">{mensaje.contenido}</p>
        <p className={cn("mt-1 text-right text-[10px]", tsColor)}>
          {hora(mensaje.enviado_at)}
        </p>
      </div>
    </div>
  );
}
