"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LuBellRing,
  LuClock,
  LuShoppingCart,
  LuCreditCard,
  LuCheck,
  LuX,
} from "react-icons/lu";
import { useToast } from "@/components/ui/Toast";
import { formatMoneda } from "@/lib/utils/format";
import type { CodigoPendiente } from "@/lib/queries/kiosco.queries";
import {
  autorizarCodigoAction,
  rechazarCodigoAction,
} from "@/app/(tenant)/[slug]/caja/autorizaciones-actions";

const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercadopago: "MercadoPago",
};

function restante(expiraAt: string, now: number): string {
  const s = Math.max(0, Math.round((new Date(expiraAt).getTime() - now) / 1000));
  const mm = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function AutorizacionesPendientes({
  codigos,
}: {
  codigos: CodigoPendiente[];
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [now, setNow] = useState(() => Date.now());
  const [confirmar, setConfirmar] = useState<CodigoPendiente | null>(null);
  const [pending, start] = useTransition();

  // Tick del countdown (1s) y polling de refresco (30s) mientras haya pendientes.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => router.refresh(), 30000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [router]);

  function autorizar(c: CodigoPendiente) {
    start(async () => {
      const r = await autorizarCodigoAction(c.id);
      if (!r.ok) {
        toastError("No se pudo autorizar", r.error ?? "Inténtalo de nuevo.");
        return;
      }
      success(
        r.tipo === "membresia" ? "Membresía renovada" : "Compra autorizada"
      );
      setConfirmar(null);
      router.refresh();
    });
  }

  function rechazar(c: CodigoPendiente) {
    start(async () => {
      const r = await rechazarCodigoAction(c.id);
      if (!r.ok) {
        toastError("No se pudo rechazar", r.error ?? "Inténtalo de nuevo.");
        return;
      }
      success("Autorización rechazada");
      router.refresh();
    });
  }

  if (codigos.length === 0) return null;

  return (
    <section className="space-y-3 rounded-xl border border-warning/40 bg-warning/[0.06] p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-warning">
        <LuBellRing className="h-4 w-4" />
        Autorizaciones pendientes ({codigos.length})
      </h3>

      <div className="space-y-2">
        {codigos.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {c.tipo === "membresia" ? (
                  <LuCreditCard className="h-4 w-4 text-brand-green" />
                ) : (
                  <LuShoppingCart className="h-4 w-4 text-brand-green" />
                )}
                <span className="font-medium text-text-primary">
                  {c.miembroNombre ?? "Miembro"}
                </span>
                <span className="text-xs text-text-muted">
                  · {c.tipo === "membresia" ? "Renovación" : "Compra"}
                </span>
              </div>
              <p className="mt-0.5 truncate text-sm text-text-secondary">
                {c.detalle}
              </p>
              <p className="mt-0.5 text-sm">
                <span className="font-semibold text-text-primary">
                  {formatMoneda(c.total)}
                </span>{" "}
                <span className="text-text-muted">
                  · {METODO_LABEL[c.metodo] ?? c.metodo}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="font-mono text-2xl font-bold tracking-widest text-text-primary">
                  {c.codigo}
                </p>
                <p className="inline-flex items-center gap-1 text-xs text-text-muted">
                  <LuClock className="h-3 w-3" /> {restante(c.expiraAt, now)}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmar(c)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <LuCheck className="h-3.5 w-3.5" /> Autorizar
                </button>
                <button
                  type="button"
                  onClick={() => rechazar(c)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:text-danger disabled:opacity-50"
                >
                  <LuX className="h-3.5 w-3.5" /> Rechazar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de confirmación */}
      {confirmar && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setConfirmar(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <h4 className="text-lg font-semibold text-text-primary">
              Confirmar {confirmar.tipo === "membresia" ? "renovación" : "compra"}
            </h4>
            <p className="mt-2 text-sm text-text-secondary">
              ¿Confirmas que recibiste{" "}
              <span className="font-semibold text-text-primary">
                {formatMoneda(confirmar.total)}
              </span>{" "}
              en {METODO_LABEL[confirmar.metodo]?.toLowerCase() ?? confirmar.metodo} de{" "}
              {confirmar.miembroNombre ?? "el miembro"}?
            </p>
            <p className="mt-2 rounded-lg bg-bg px-3 py-2 text-sm text-text-secondary">
              {confirmar.tipo === "membresia" ? "Plan: " : "Productos: "}
              <span className="text-text-primary">{confirmar.detalle}</span>
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmar(null)}
                disabled={pending}
                className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => autorizar(confirmar)}
                disabled={pending}
                className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Confirmando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
