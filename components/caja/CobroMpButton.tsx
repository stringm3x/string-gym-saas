"use client";

import { useEffect, useState, useTransition } from "react";
import { LuCreditCard, LuExternalLink, LuSearch, LuX } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { crearCobroMpAction } from "@/app/(tenant)/[slug]/caja/mp-actions";
import { searchMiembrosAction } from "@/app/(tenant)/[slug]/checkins/actions";
import type { PlanMembresia } from "@/lib/queries/planes.queries";

type MiembroLite = { id: string; nombre: string };

const INPUT =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none";

export function CobroMpButton({
  planes,
  gymNombre,
}: {
  planes: PlanMembresia[];
  gymNombre: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [monto, setMonto] = useState("");
  const [planId, setPlanId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  // Miembro (opcional): si se selecciona y hay plan, el webhook extiende su
  // vencimiento al confirmarse el pago.
  const [miembro, setMiembro] = useState<MiembroLite | null>(null);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<MiembroLite[]>([]);

  useEffect(() => {
    if (miembro) return;
    let cancel = false;
    const t = setTimeout(async () => {
      if (query.trim().length < 2) {
        if (!cancel) setResultados([]);
        return;
      }
      const r = await searchMiembrosAction(query);
      if (!cancel) setResultados(r.map((m) => ({ id: m.id, nombre: m.nombre })));
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [query, miembro]);

  function reset() {
    setTitulo("");
    setMonto("");
    setPlanId("");
    setError(null);
    setLink(null);
    setMiembro(null);
    setQuery("");
    setResultados([]);
  }

  function elegirPlan(id: string) {
    setPlanId(id);
    const p = planes.find((x) => x.id === id);
    if (p) {
      setMonto(String(p.precio));
      setTitulo(`Membresía ${p.nombre} - ${gymNombre}`);
    }
  }

  function generar() {
    setError(null);
    start(async () => {
      const r = await crearCobroMpAction({
        titulo: titulo.trim(),
        monto: Number(monto),
        planId: planId || undefined,
        miembroId: miembro?.id || undefined,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setLink(r.initPoint);
      window.open(r.initPoint, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-brand-green/40 bg-brand-green/10 px-4 py-2.5 text-sm font-semibold text-brand-green hover:bg-brand-green/20"
      >
        <LuCreditCard className="h-4 w-4" /> Cobrar con MercadoPago
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cobrar con MercadoPago"
        description="Genera un link de pago (tarjeta, OXXO o SPEI)."
      >
        {link ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-text-secondary">
              Link de pago generado. Se abrió en una pestaña nueva.
            </p>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-bg hover:bg-brand-green/90"
            >
              <LuExternalLink className="h-4 w-4" /> Abrir checkout
            </a>
            <p className="text-[11px] text-text-muted">
              El cobro se confirmará automáticamente cuando se pague.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Miembro (opcional) — necesario para extender su vencimiento */}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Miembro (opcional)
              </label>
              {miembro ? (
                <div className="flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2 text-sm">
                  <span className="text-text-primary">{miembro.nombre}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMiembro(null);
                      setQuery("");
                    }}
                    className="text-text-muted hover:text-danger"
                    aria-label="Quitar miembro"
                  >
                    <LuX className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <LuSearch className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar miembro…"
                    className={`${INPUT} pl-9`}
                  />
                  {resultados.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                      {resultados.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setMiembro(m);
                              setResultados([]);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg"
                          >
                            {m.nombre}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {planes.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Plan (opcional)
                </label>
                <select
                  value={planId}
                  onChange={(e) => elegirPlan(e.target.value)}
                  className={INPUT}
                >
                  <option value="">Personalizado…</option>
                  {planes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — ${p.precio}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Descripción
              </label>
              <input
                className={INPUT}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej. Membresía mensual"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Monto (MXN)
              </label>
              <input
                type="number"
                min={1}
                className={INPUT}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
              />
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <button
              type="button"
              disabled={pending || !titulo.trim() || !monto || Number(monto) <= 0}
              onClick={generar}
              className="w-full rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-bg hover:bg-brand-green/90 disabled:opacity-50"
            >
              {pending ? "Generando…" : "Generar link de pago"}
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
