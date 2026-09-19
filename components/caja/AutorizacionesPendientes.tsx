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
import { Button } from "@/components/ui/Button";
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
    <section className="border border-warning/40 bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h3 className="flex items-center gap-2 text-base font-semibold text-text-primary">
          <LuBellRing className="h-4 w-4 text-warning" aria-hidden="true" />
          Autorizaciones pendientes
        </h3>
        <span className="font-mono text-etiqueta text-text-muted">
          {codigos.length}
        </span>
      </div>

      <ul className="divide-y divide-border">
        {codigos.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[15px] leading-5 text-text-primary">
                {c.tipo === "membresia" ? (
                  <LuCreditCard className="h-4 w-4 text-text-muted" aria-hidden="true" />
                ) : (
                  <LuShoppingCart className="h-4 w-4 text-text-muted" aria-hidden="true" />
                )}
                {c.miembroNombre ?? "Miembro"}
                <span className="text-sm text-text-muted">
                  · {c.tipo === "membresia" ? "Renovación" : "Compra"}
                </span>
              </p>
              <p className="mt-0.5 truncate text-sm text-text-secondary">
                {c.detalle}
              </p>
              <p className="mt-0.5 text-sm text-text-muted">
                <span className="font-mono text-dato tabular-nums text-text-primary">
                  {formatMoneda(c.total)}
                </span>{" "}
                · {METODO_LABEL[c.metodo] ?? c.metodo}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="font-mono text-2xl font-bold tracking-[0.2em] text-text-primary">
                  {c.codigo}
                </p>
                <p className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-text-muted">
                  <LuClock className="h-3 w-3" aria-hidden="true" />{" "}
                  {restante(c.expiraAt, now)}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setConfirmar(c)}
                  disabled={pending}
                  leftIcon={<LuCheck className="h-4 w-4" />}
                >
                  Autorizar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => rechazar(c)}
                  disabled={pending}
                  leftIcon={<LuX className="h-4 w-4" />}
                >
                  Rechazar
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Modal de confirmación */}
      {confirmar && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="autorizacion-titulo"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setConfirmar(null)}
            className="absolute inset-0 bg-bg/70"
          />
          <div className="relative w-full max-w-md border border-border bg-surface">
            <div className="border-b border-border px-6 py-4">
              <h4
                id="autorizacion-titulo"
                className="text-base font-semibold text-text-primary"
              >
                Confirmar{" "}
                {confirmar.tipo === "membresia" ? "renovación" : "compra"}
              </h4>
            </div>
            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-text-secondary">
                ¿Confirmas que recibiste{" "}
                <span className="font-mono text-dato tabular-nums text-text-primary">
                  {formatMoneda(confirmar.total)}
                </span>{" "}
                en{" "}
                {METODO_LABEL[confirmar.metodo]?.toLowerCase() ??
                  confirmar.metodo}{" "}
                de {confirmar.miembroNombre ?? "el miembro"}?
              </p>
              <p className="border border-border bg-bg px-4 py-3 text-sm text-text-secondary">
                {confirmar.tipo === "membresia" ? "Plan: " : "Productos: "}
                <span className="text-text-primary">{confirmar.detalle}</span>
              </p>
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConfirmar(null)}
                  disabled={pending}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => autorizar(confirmar)}
                  loading={pending}
                >
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
