"use client";

import { useEffect } from "react";
import { logError } from "@/lib/log";
import { ErrorScreen } from "@/components/ui/ErrorScreen";

/** Boundary del panel de administración de STRING. AdminShell (nav, sesión) no se desmonta. */
export default function ErrorAdmin({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    logError("error_boundary.admin", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <ErrorScreen
      title="Esta pantalla tuvo un problema"
      onRetry={unstable_retry}
      volver={{ href: "/admin", label: "Ir al panel" }}
      detalle={error.message}
    />
  );
}
