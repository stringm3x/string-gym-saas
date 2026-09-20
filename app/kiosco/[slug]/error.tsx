"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { logError } from "@/lib/log";
import { ErrorScreen } from "@/components/ui/ErrorScreen";

/**
 * Boundary del kiosco de autoservicio: pantalla pública sin sesión propia,
 * normalmente montada en una tablet en recepción. Aquí "conservar estado" no
 * aplica (no hay nada de staff que perder) — lo que importa es que alguien
 * pueda tocar "Reintentar" sin ir a buscar quién reinicie la tablet.
 */
export default function ErrorKiosco({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    logError("error_boundary.kiosco", {
      digest: error.digest,
      message: error.message,
      pathname,
    });
  }, [error, pathname]);

  const slug = pathname?.split("/")[2] ?? "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <ErrorScreen
        title="Algo falló"
        description="Vuelve a intentarlo. Si sigue sin funcionar, avísale a recepción."
        onRetry={unstable_retry}
        volver={slug ? { href: `/kiosco/${slug}`, label: "Volver al inicio" } : undefined}
        detalle={error.message}
      />
    </div>
  );
}
