"use client";

import { useEffect } from "react";

/**
 * Solo se activa si el LAYOUT RAÍZ mismo revienta (no un segmento) — el caso
 * más raro y más grave. Reemplaza <html>/<body> por completo, así que no
 * puede depender de globals.css, fuentes ni componentes: si esos fallaron,
 * esta pantalla igual tiene que verse. Estilos en línea a propósito.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Sin lib/log aquí: el layout raíz está caído, mejor no depender de más
    // módulos de los estrictamente necesarios para pintar esta pantalla.
    console.error(
      JSON.stringify({
        nivel: "error",
        tag: "error_boundary.global",
        digest: error.digest,
        message: error.message,
      })
    );
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#0d0d0d",
          color: "#f5f5f5",
        }}
      >
        <div style={{ textAlign: "center", padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
            STRING GYM no pudo cargar
          </h1>
          <p style={{ color: "#a3a3a3", marginBottom: 24 }}>
            Fue un problema al arrancar la aplicación, no en lo que estabas
            haciendo. Intenta de nuevo.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              height: 44,
              padding: "0 20px",
              background: "#50ff05",
              color: "#0d0d0d",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
