"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

/**
 * Escáner de QR por cámara usando html5-qrcode (import lazy, solo cliente).
 * Llama onDetect con el texto decodificado. Si no hay cámara o falla, muestra
 * un aviso y el usuario puede usar el input de texto.
 */
export default function QrCameraScanner({
  onDetect,
}: {
  onDetect: (text: string) => void;
}) {
  const containerId = useId();
  const [error, setError] = useState<string | null>(null);
  const onDetectRef = useRef(onDetect);

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    let scanner: Html5Qrcode | null = null;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (cancelled) return;
        scanner = new mod.Html5Qrcode(containerId);
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 240 },
          (decoded) => onDetectRef.current(decoded),
          () => {}
        );
      } catch {
        if (!cancelled) setError("No se pudo acceder a la cámara.");
      }
    })();

    return () => {
      cancelled = true;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner && scanner.clear())
          .catch(() => {});
      }
    };
  }, [containerId]);

  return (
    <div className="mx-auto w-full max-w-sm">
      <div id={containerId} className="overflow-hidden rounded-xl" />
      {error && <p className="mt-2 text-center text-sm text-danger">{error}</p>}
    </div>
  );
}
