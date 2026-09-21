"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { logError } from "@/lib/log";
import { ErrorScreen } from "@/components/ui/ErrorScreen";

/**
 * Boundary del panel del gimnasio. error.tsx NO envuelve el layout.tsx del
 * mismo segmento — el sidebar, el header y el ToastProvider siguen montados;
 * solo el área de contenido (<main>) cae aquí. Es lo que se conserva "donde
 * se pueda": el cajero no pierde la sesión ni la navegación, solo la
 * pantalla que reventó, y unstable_retry() la vuelve a pedir al servidor.
 */
export default function ErrorPanel({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    logError("error_boundary.panel", {
      digest: error.digest,
      message: error.message,
      pathname,
    });
  }, [error, pathname]);

  const slug = pathname?.split("/")[1] ?? "";

  return (
    <ErrorScreen
      title="Esta pantalla tuvo un problema"
      description="No se perdió tu sesión ni lo que ya estaba guardado. Intenta de nuevo — si vuelve a pasar, es un problema real y ya quedó registrado."
      onRetry={unstable_retry}
      volver={slug ? { href: `/${slug}/hoy`, label: "Ir al panel del día" } : undefined}
      detalle={error.message}
    />
  );
}
