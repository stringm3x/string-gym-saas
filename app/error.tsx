"use client";

import { useEffect } from "react";
import { logError } from "@/lib/log";
import { ErrorScreen } from "@/components/ui/ErrorScreen";

/**
 * Boundary raíz: cubre todo lo que no tiene un error.tsx más específico
 * (login, recuperar-password, qr, recibos públicos, api-docs, sdk-docs).
 * unstable_retry() re-renderiza solo el segmento roto — el layout raíz
 * (fuentes, <html>/<body>) no se desmonta.
 */
export default function ErrorRaiz({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    logError("error_boundary.raiz", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <ErrorScreen
        onRetry={unstable_retry}
        volver={{ href: "/login", label: "Ir al inicio" }}
        detalle={error.message}
      />
    </div>
  );
}
