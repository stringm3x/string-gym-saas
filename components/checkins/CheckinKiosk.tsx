"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { LuSearch, LuCircleCheck, LuCircleAlert, LuUser } from "react-icons/lu";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { TZ_MX } from "@/lib/utils/dates";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils/cn";
import {
  getEstadoMembresia,
  type EstadoMembresia,
} from "@/lib/utils/estado-membresia";
import {
  registerCheckinAction,
  searchMiembrosAction,
} from "@/app/(tenant)/[slug]/checkins/actions";

interface SearchResult {
  id: string;
  nombre: string;
  telefono: string | null;
  fecha_vencimiento: string | null;
}

interface LastCheckin {
  id: string;
  nombre: string;
  estadoMembresia: EstadoMembresia;
  hora: string;
}

const DEBOUNCE_MS = 200;

export function CheckinKiosk() {
  const { error: toastError } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [lastCheckin, setLastCheckin] = useState<LastCheckin | null>(null);

  // Foco inicial en el input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce de la búsqueda
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const r = await searchMiembrosAction(query);
        setResults(r);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(t);
  }, [query]);

  const handleCheckin = useCallback(
    (miembroId: string) => {
      startTransition(async () => {
        const result = await registerCheckinAction(miembroId);

        if (!result.ok || !result.miembro) {
          toastError(
            "No se pudo registrar",
            result.error ?? "Inténtalo de nuevo"
          );
          return;
        }

        setLastCheckin({
          id: result.miembro.id,
          nombre: result.miembro.nombre,
          estadoMembresia: result.miembro.estadoMembresia as EstadoMembresia,
          hora: new Date().toLocaleTimeString("es-MX", {
            timeZone: TZ_MX,
            hour: "2-digit",
            minute: "2-digit",
          }),
        });

        // Limpiar búsqueda y refocus para el siguiente
        setQuery("");
        setResults([]);
        inputRef.current?.focus();
      });
    },
    [toastError]
  );

  return (
    <div className="space-y-6">
      <div className="relative">
        <Input
          ref={inputRef}
          type="search"
          placeholder="Buscar por nombre o teléfono…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          leftSlot={<LuSearch className="h-5 w-5" />}
          className="h-14 text-base"
          aria-label="Buscar miembro para check-in"
          autoComplete="off"
        />

        {/* Resultados — dropdown */}
        {(results.length > 0 || (query.trim().length >= 2 && !isSearching)) && (
          <div className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
            {results.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-text-secondary">
                Sin coincidencias para "{query}"
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {results.map((m) => {
                  const estado = getEstadoMembresia(m.fecha_vencimiento);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => handleCheckin(m.id)}
                        disabled={isPending}
                        className={cn(
                          "flex w-full items-center justify-between gap-4 px-4 py-3 text-left",
                          "transition-colors duration-150",
                          "hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none",
                          "disabled:cursor-wait disabled:opacity-60"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-text-muted">
                            <LuUser className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-text-primary">
                              {m.nombre}
                            </p>
                            {m.telefono && (
                              <p className="truncate font-mono text-xs text-text-secondary">
                                {m.telefono}
                              </p>
                            )}
                          </div>
                        </div>

                        <EstadoMini estado={estado} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Confirmación grande del último check-in */}
      {lastCheckin && <CheckinConfirmation checkin={lastCheckin} />}
    </div>
  );
}

function EstadoMini({ estado }: { estado: EstadoMembresia }) {
  const labels: Record<
    EstadoMembresia,
    { label: string; variant: "success" | "warning" | "danger" | "neutral" }
  > = {
    activo: { label: "Activo", variant: "success" },
    por_vencer: { label: "Por vencer", variant: "warning" },
    vencido: { label: "Vencido", variant: "danger" },
    sin_membresia: { label: "Sin membresía", variant: "neutral" },
  };

  const cfg = labels[estado];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function CheckinConfirmation({ checkin }: { checkin: LastCheckin }) {
  const isAlert =
    checkin.estadoMembresia === "vencido" ||
    checkin.estadoMembresia === "sin_membresia";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-4 rounded-xl border p-5 transition-colors duration-200",
        isAlert
          ? "border-danger/30 bg-danger/10"
          : "border-brand-green/30 bg-brand-green/10"
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
          isAlert
            ? "bg-danger/20 text-danger"
            : "bg-brand-green/20 text-brand-green"
        )}
      >
        {isAlert ? (
          <LuCircleAlert className="h-6 w-6" />
        ) : (
          <LuCircleCheck className="h-6 w-6" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-wider text-text-muted">
          Check-in registrado · {checkin.hora}
        </p>
        <p className="mt-0.5 truncate text-lg font-semibold text-text-primary">
          {checkin.nombre}
        </p>
        {isAlert && (
          <p className="mt-0.5 text-xs text-danger">
            {checkin.estadoMembresia === "vencido"
              ? "Membresía vencida — invita a renovar."
              : "Sin membresía registrada."}
          </p>
        )}
      </div>
    </div>
  );
}
