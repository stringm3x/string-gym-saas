"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuSearch, LuUser } from "react-icons/lu";
import {
  buscarMiembrosAction,
  type ResultadoBusqueda,
} from "@/app/(tenant)/[slug]/buscar-actions";

export function GlobalSearch({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function cerrar() {
    setOpen(false);
    setQ("");
    setResultados([]);
  }

  // Atajo Cmd/Ctrl+K y Escape (global).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
        setQ("");
        setResultados([]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Foco al abrir (sin setState en el efecto).
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Búsqueda en vivo con debounce (todo el setState va dentro del timeout).
  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim().length < 2) {
        setResultados([]);
        return;
      }
      start(async () => {
        const r = await buscarMiembrosAction(q);
        setResultados(r);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  function ir(id: string) {
    cerrar();
    router.push(`/${slug}/miembros/${id}`);
  }

  return (
    <>
      {/* Mobile: ícono. sm+: pill con placeholder + atajo. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar miembros"
        title="Buscar (⌘K)"
        className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface hover:text-text-primary sm:hidden"
      >
        <LuSearch className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar miembros"
        className="hidden items-center gap-2 rounded-lg border border-border bg-surface py-1.5 pl-3 pr-2 text-sm text-text-muted transition-colors hover:border-brand-green/40 hover:text-text-secondary sm:flex"
      >
        <LuSearch className="h-4 w-4" />
        <span>Buscar miembros…</span>
        <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Cerrar búsqueda"
            onClick={cerrar}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <LuSearch className="h-4 w-4 shrink-0 text-text-muted" />
              <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar miembro por nombre o teléfono…"
                className="w-full bg-transparent py-3.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-muted sm:block">
                ESC
              </kbd>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {q.trim().length < 2 ? (
                <p className="px-4 py-6 text-center text-xs text-text-muted">
                  Escribe al menos 2 caracteres.
                </p>
              ) : pending && resultados.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-text-muted">
                  Buscando…
                </p>
              ) : resultados.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-text-muted">
                  Sin resultados.
                </p>
              ) : (
                <ul>
                  {resultados.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => ir(m.id)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-bg"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-green/10 text-brand-green">
                          <LuUser className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-text-primary">
                            {m.nombre}
                          </span>
                          {m.telefono && (
                            <span className="block truncate text-xs text-text-secondary">
                              {m.telefono}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
