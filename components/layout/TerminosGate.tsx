"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuFileText } from "react-icons/lu";
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex flex-col items-center gap-3 border-b border-border px-6 py-6 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-green/10 text-brand-green">
            <LuFileText className="h-5 w-5" />
          </span>
          <h2
            id="terminos-title"
            className="text-base font-semibold text-text-primary"
          >
            Antes de continuar, acepta nuestros términos
          </h2>
          <p className="text-xs text-text-secondary">
            Para usar STRING GYM necesitamos que aceptes las condiciones del
            servicio.
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={aceptado}
              onChange={(e) => setAceptado(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-green"
            />
            <span className="text-sm text-text-secondary">
              Acepto los{" "}
              <a
                href={TERMINOS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-green underline underline-offset-2 hover:opacity-80"
              >
                Términos de Servicio
              </a>{" "}
              y el{" "}
              <a
                href={PRIVACIDAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-green underline underline-offset-2 hover:opacity-80"
              >
                Aviso de Privacidad
              </a>
              .
            </span>
          </label>

          {error && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={!aceptado || pending}
            onClick={confirmar}
            className="w-full rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Aceptar y continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
