"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aceptarTerminosAction } from "@/app/(tenant)/[slug]/terminos-actions";
import { TERMINOS_URL, PRIVACIDAD_URL } from "@/lib/constants";

/**
 * Modal bloqueante de Términos (Fase 7.3). Se monta en el layout del tenant
 * cuando el gym aún no ha aceptado. No se puede cerrar sin aceptar: no hay
 * backdrop clickable ni botón de cierre.
 */
export function TerminosGate() {
  const router = useRouter();
  const [aceptado, setAceptado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function confirmar() {
    setError(null);
    start(async () => {
      const r = await aceptarTerminosAction();
      if (!r.ok) {
        setError(r.error ?? "No se pudo registrar la aceptación.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terminos-title"
    >
      <div className="absolute inset-0 bg-bg/70" />

      <div className="relative w-full max-w-md border border-border bg-surface">
        <div className="flex flex-col gap-3 border-b border-border px-6 py-6">
          <p className="font-mono text-etiqueta uppercase text-brand-green">
            Antes de empezar
          </p>
          <h2
            id="terminos-title"
            className="text-lg font-semibold text-text-primary"
          >
            Acepta los términos del servicio
          </h2>
          <p className="text-sm text-text-secondary">
            Para usar STRING GYM necesitamos que aceptes las condiciones del
            servicio y el aviso de privacidad.
          </p>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={aceptado}
              onChange={(e) => setAceptado(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-brand-green"
            />
            <span className="text-sm text-text-secondary">
              Acepto los{" "}
              <a
                href={TERMINOS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-green underline underline-offset-4"
              >
                Términos de Servicio
              </a>{" "}
              y el{" "}
              <a
                href={PRIVACIDAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-green underline underline-offset-4"
              >
                Aviso de Privacidad
              </a>
              .
            </span>
          </label>

          {error && (
            <p
              role="alert"
              className="border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={!aceptado || pending}
            onClick={confirmar}
            className="inline-flex h-12 w-full items-center justify-center bg-brand-green px-4 text-base font-semibold text-on-brand transition-colors hover:bg-brand-green/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Aceptar y continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
