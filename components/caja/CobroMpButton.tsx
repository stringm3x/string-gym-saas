"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { LuCreditCard, LuExternalLink, LuSearch, LuX } from "react-icons/lu";
import { Modal } from "@/components/ui/Modal";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { crearCobroMpAction } from "@/app/(tenant)/[slug]/caja/mp-actions";
import { searchMiembrosAction } from "@/app/(tenant)/[slug]/checkins/actions";
import type { PlanMembresia } from "@/lib/queries/planes.queries";

type MiembroLite = { id: string; nombre: string };

const INPUT =
  "h-11 w-full rounded border border-border bg-bg px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none";

export function CobroMpButton({
  planes,
  gymNombre,
}: {
  planes: PlanMembresia[];
  gymNombre: string;
}) {
  const id = useId();
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
      <Button
        type="button"
        variant="secondary"
        leftIcon={<LuCreditCard className="h-4 w-4" />}
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="w-full"
      >
        Cobrar con MercadoPago
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cobrar con MercadoPago"
        description="Genera un link de pago (tarjeta, OXXO o SPEI)."
      >
        {link ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-text-secondary">
              Link de pago generado. Se abrió en una pestaña nueva.
            </p>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 bg-brand-green px-4 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-green/90"
            >
              <LuExternalLink className="h-4 w-4" /> Abrir checkout
            </a>
            <p className="text-sm text-text-muted">
              El cobro se confirma solo cuando se pague.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Miembro (opcional) — necesario para extender su vencimiento */}
            <div className="space-y-2">
              <Label htmlFor={`${id}-miembro`}>Miembro (opcional)</Label>
              {miembro ? (
                <div className="flex items-center justify-between gap-3 border border-border bg-bg py-1 pl-4 pr-1">
                  <span className="truncate text-[15px] leading-5 text-text-primary">
                    {miembro.nombre}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMiembro(null);
                      setQuery("");
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
                    aria-label="Quitar miembro"
                  >
                    <LuX className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input
                    id={`${id}-miembro`}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar miembro…"
                    autoComplete="off"
                    className={`${INPUT} pl-10`}
                  />
                  {resultados.length > 0 && (
                    <ul className="absolute z-10 mt-2 w-full divide-y divide-border overflow-hidden border border-border bg-surface">
                      {resultados.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setMiembro(m);
                              setResultados([]);
                            }}
                            className="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-[15px] leading-5 text-text-primary transition-colors hover:bg-surface-hover"
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
              <div className="space-y-2">
                <Label htmlFor={`${id}-plan`}>Plan (opcional)</Label>
                <select
                  id={`${id}-plan`}
                  value={planId}
                  onChange={(e) => elegirPlan(e.target.value)}
                  className={`${INPUT} cursor-pointer`}
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
            <div className="space-y-2">
              <Label htmlFor={`${id}-titulo`}>Descripción</Label>
              <input
                id={`${id}-titulo`}
                className={INPUT}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej. Membresía mensual"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-monto`}>Monto (MXN)</Label>
              <input
                id={`${id}-monto`}
                type="number"
                inputMode="decimal"
                min={1}
                className={`${INPUT} font-mono tabular-nums`}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <Button
              type="button"
              disabled={!titulo.trim() || !monto || Number(monto) <= 0}
              loading={pending}
              onClick={generar}
              className="w-full"
            >
              Generar link de pago
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
