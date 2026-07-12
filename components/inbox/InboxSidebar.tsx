"use client";

import { useMemo, useState } from "react";
import { LuSearch } from "react-icons/lu";
import type { ConversacionResumen } from "@/lib/queries/inbox.queries";
import { cn } from "@/lib/utils/cn";

/** Nombre visible: miembro vinculado → contacto → teléfono. */
export function nombreVisible(c: ConversacionResumen): string {
  return c.miembro_nombre ?? c.nombre_contacto ?? c.telefono;
}

function iniciales(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).slice(0, 2);
  const ini = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  return ini || "?";
}

/** Tiempo relativo compacto (ahora, hace 5 min, hace 2 h, ayer, 12 jul). */
export function tiempoRelativo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} d`;
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(iso));
}

interface InboxSidebarProps {
  conversaciones: ConversacionResumen[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function InboxSidebar({
  conversaciones,
  activeId,
  onSelect,
}: InboxSidebarProps) {
  const [q, setQ] = useState("");

  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return conversaciones;
    return conversaciones.filter((c) => {
      const nombre = nombreVisible(c).toLowerCase();
      return nombre.includes(term) || c.telefono.includes(term);
    });
  }, [conversaciones, q]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border p-3">
        <div className="relative">
          <LuSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o teléfono"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtradas.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            {conversaciones.length === 0
              ? "Aún no hay conversaciones."
              : "Sin resultados."}
          </p>
        ) : (
          <ul>
            {filtradas.map((c) => {
              const nombre = nombreVisible(c);
              const activa = c.id === activeId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-border/60 px-3 py-3 text-left transition-colors",
                      activa
                        ? "bg-brand-green/10"
                        : "hover:bg-text-primary/[0.04]"
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-green/15 text-sm font-semibold text-brand-green">
                      {iniciales(nombre)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-text-primary">
                          {nombre}
                        </span>
                        <span className="shrink-0 text-[11px] text-text-muted">
                          {tiempoRelativo(c.ultimo_mensaje_at)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-text-secondary">
                          {c.ultimo_mensaje ?? "—"}
                        </span>
                        {c.no_leidos > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold text-text-primary">
                            {c.no_leidos}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
