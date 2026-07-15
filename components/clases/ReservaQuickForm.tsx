"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuSearch, LuUserPlus, LuTriangleAlert } from "react-icons/lu";
import {
  buscarMiembrosAction,
  createReservaAction,
} from "@/app/(tenant)/[slug]/clases/[sesionId]/actions";

const INPUT =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none";

type MiembroLite = { id: string; nombre: string; telefono: string | null };

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
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">
        Agregar reserva
      </h3>

      <div className="mb-3 flex gap-1 rounded-lg border border-border p-0.5 text-xs">
        {(["miembro", "visitante"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium capitalize transition-colors ${
              tab === t
                ? "bg-brand-green/10 text-brand-green"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "miembro" ? (
        <div className="space-y-2">
          <div className="relative">
            <LuSearch className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
            <input
              className={`${INPUT} pl-9`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar miembro por nombre o teléfono…"
            />
          </div>
          {resultados.length > 0 && (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {resultados.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => reservar({ miembroId: m.id })}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-bg disabled:opacity-50"
                  >
                    <span className="text-text-primary">{m.nombre}</span>
                    <span className="text-xs text-text-muted">
                      {m.telefono ?? ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <input
            className={INPUT}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del visitante"
          />
          <input
            className={INPUT}
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="Teléfono"
          />
          <button
            type="button"
            disabled={pending || !nombre.trim()}
            onClick={() =>
              reservar({
                nombreVisitante: nombre.trim(),
                telefonoVisitante: telefono.trim() || undefined,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-2 text-xs font-semibold text-bg hover:bg-brand-green/90 disabled:opacity-50"
          >
            <LuUserPlus className="h-3.5 w-3.5" /> Reservar visitante
          </button>
        </div>
      )}

      {msg && (
        <p
          className={`mt-2 flex items-center gap-1 text-xs ${
            msg.ok ? "text-brand-green" : "text-danger"
          }`}
        >
          {msg.advertencia && (
            <LuTriangleAlert className="h-3.5 w-3.5 shrink-0 text-warning" />
          )}
          {msg.text}
        </p>
      )}
    </div>
  );
}
