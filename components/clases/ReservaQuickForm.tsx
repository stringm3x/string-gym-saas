"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuSearch, LuUserPlus, LuTriangleAlert } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import {
  buscarMiembrosAction,
  createReservaAction,
} from "@/app/(tenant)/[slug]/clases/[sesionId]/actions";

const INPUT =
  "h-11 w-full rounded border border-border bg-bg px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none";

type MiembroLite = { id: string; nombre: string; telefono: string | null };

/** Agregar reserva a la sesión: pestañas miembro/visitante con el estado
 * seleccionado (fondo lleno + ácido), inputs de 44px. */
export function ReservaQuickForm({ sesionId }: { sesionId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"miembro" | "visitante">("miembro");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{
    ok: boolean;
    text: string;
    advertencia?: boolean;
  } | null>(null);

  // Miembro (autocomplete)
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<MiembroLite[]>([]);

  // Visitante
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");

  useEffect(() => {
    if (tab !== "miembro") return;
    let cancel = false;
    const t = setTimeout(async () => {
      if (query.trim().length < 2) {
        if (!cancel) setResultados([]);
        return;
      }
      const r = await buscarMiembrosAction(query);
      if (!cancel) setResultados(r);
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [query, tab]);

  function reservar(input: {
    miembroId?: string;
    nombreVisitante?: string;
    telefonoVisitante?: string;
  }) {
    setMsg(null);
    start(async () => {
      const r = await createReservaAction(sesionId, input);
      if (!r.ok) {
        setMsg({ ok: false, text: r.error ?? "Error" });
        return;
      }
      const base = r.enListaEspera
        ? "Agregado a lista de espera (sin cupo)."
        : "Reserva confirmada.";
      setMsg({
        ok: true,
        text: r.advertencia ? `${base} ${r.advertencia}` : base,
        advertencia: !!r.advertencia,
      });
      setQuery("");
      setResultados([]);
      setNombre("");
      setTelefono("");
      router.refresh();
    });
  }

  return (
    <section className="card-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-text-primary">
          Agregar reserva
        </h3>
        <div className="flex items-center gap-2">
          {(["miembro", "visitante"] as const).map((t) => {
            const activo = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-pressed={activo}
                className={cn(
                  "inline-flex h-9 items-center border px-3 text-sm capitalize transition-colors",
                  activo
                    ? "border-brand-green bg-surface-hover text-brand-green"
                    : "border-border text-text-secondary hover:border-text-secondary hover:text-text-primary"
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-5">
        {tab === "miembro" ? (
          <>
            <div className="relative">
              <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                className={`${INPUT} pl-10`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar miembro por nombre o teléfono…"
                aria-label="Buscar miembro"
                autoComplete="off"
              />
            </div>
            {resultados.length > 0 && (
              <ul className="divide-y divide-border border border-border bg-bg">
                {resultados.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => reservar({ miembroId: m.id })}
                      className="flex min-h-11 w-full items-center justify-between gap-4 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover disabled:opacity-50"
                    >
                      <span className="truncate text-[15px] leading-5 text-text-primary">
                        {m.nombre}
                      </span>
                      <span className="shrink-0 font-mono text-dato text-text-muted">
                        {m.telefono ?? ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <input
              className={INPUT}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del visitante"
              aria-label="Nombre del visitante"
            />
            <input
              className={INPUT}
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Teléfono"
              aria-label="Teléfono del visitante"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!nombre.trim()}
              loading={pending}
              onClick={() =>
                reservar({
                  nombreVisitante: nombre.trim(),
                  telefonoVisitante: telefono.trim() || undefined,
                })
              }
              leftIcon={<LuUserPlus className="h-4 w-4" />}
              className="self-start"
            >
              Reservar visitante
            </Button>
          </>
        )}

        {msg && (
          <p
            role="status"
            className={cn(
              "flex items-center gap-1.5 text-sm",
              msg.ok ? "text-text-secondary" : "text-danger"
            )}
          >
            {msg.advertencia && (
              <LuTriangleAlert
                className="h-4 w-4 shrink-0 text-warning"
                aria-hidden="true"
              />
            )}
            {msg.text}
          </p>
        )}
      </div>
    </section>
  );
}
