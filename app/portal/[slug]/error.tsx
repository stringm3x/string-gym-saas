"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { logError } from "@/lib/log";
import { ErrorScreen } from "@/components/ui/ErrorScreen";

/** Boundary del portal del socio. El layout (header, ToastProvider) no se desmonta. */
export default function ErrorPortal({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    logError("error_boundary.portal", {
      digest: error.digest,
      message: error.message,
      pathname,
    });
  }, [error, pathname]);

  const slug = pathname?.split("/")[2] ?? "";

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center">
      <ErrorScreen
        title="Esta pantalla tuvo un problema"
        description="Tu sesión sigue activa. Intenta de nuevo en un momento."
        onRetry={unstable_retry}
        volver={slug ? { href: `/portal/${slug}`, label: "Ir al inicio" } : undefined}
        detalle={error.message}
      />
    </div>
  );
}
