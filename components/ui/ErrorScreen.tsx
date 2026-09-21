"use client";

import Link from "next/link";
import { LuCircleAlert, LuRotateCw } from "react-icons/lu";
import { Button } from "./Button";

interface ErrorScreenProps {
  title?: string;
  description?: string;
  /** unstable_retry() de error.tsx: re-fetch + re-render del segmento roto,
   * sin recargar toda la pestaña. El layout que envuelve a error.tsx (sidebar,
   * header, toasts) nunca se desmonta — solo el área de la página. */
  onRetry: () => void;
  /** Salida cuando reintentar no basta (ej. la URL en sí está mal). */
  volver?: { href: string; label: string };
  /** Solo en desarrollo: mensaje crudo del error, para no perseguir el digest. */
  detalle?: string;
}

export function ErrorScreen({
  title = "Algo salió mal",
  description = "Puede ser un problema pasajero — intenta de nuevo. Si se repite, es un problema real y ya quedó registrado.",
  onRetry,
  volver,
  detalle,
}: ErrorScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="text-danger [&>svg]:h-12 [&>svg]:w-12 [&>svg]:stroke-[1.75]"
      >
        <LuCircleAlert />
      </span>

      <div className="flex flex-col items-center gap-3">
        <h3 className="font-display text-titular-m uppercase text-text-primary">
          {title}
        </h3>
        <p className="max-w-md text-cuerpo-s text-text-secondary">{description}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onRetry} leftIcon={<LuRotateCw className="h-4 w-4" />}>
          Reintentar
        </Button>
        {volver && (
          <Link
            href={volver.href}
            className="inline-flex h-11 items-center justify-center border border-border px-4 text-sm font-semibold text-text-primary transition-colors duration-150 hover:border-text-secondary"
          >
            {volver.label}
          </Link>
        )}
      </div>

      {detalle && process.env.NODE_ENV !== "production" && (
        <pre className="max-w-lg overflow-auto border border-border bg-surface p-3 text-left font-mono text-etiqueta text-text-muted">
          {detalle}
        </pre>
      )}
    </div>
  );
}
