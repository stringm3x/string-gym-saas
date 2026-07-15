"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LuArrowLeftRight } from "react-icons/lu";
import type { Html5Qrcode } from "html5-qrcode";

interface Cam {
  id: string;
  label: string;
}

/**
 * Escáner de QR por cámara usando html5-qrcode (import lazy, solo cliente).
 * Enumera las cámaras disponibles; si hay más de una, muestra un botón para
 * alternar (frontal/trasera). Llama onDetect con el texto decodificado.
 */
export default function QrCameraScanner({
  onDetect,
}: {
  onDetect: (text: string) => void;
}) {
  const containerId = useId();
  const [error, setError] = useState<string | null>(null);
  const [cams, setCams] = useState<Cam[]>([]);
  const [camIdx, setCamIdx] = useState(0);
  const onDetectRef = useRef(onDetect);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  // 1) Enumerar cámaras al montar. Prefiere la trasera.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("html5-qrcode");
        const lista = await mod.Html5Qrcode.getCameras();
        if (cancelled) return;
        const disponibles: Cam[] = (lista ?? []).map((c) => ({
          id: c.id,
          label: c.label,
        }));
        if (disponibles.length === 0) {
          setError("No se encontró ninguna cámara.");
          return;
        }
        const trasera = disponibles.findIndex((c) =>
          /back|rear|tras|environment/i.test(c.label)
        );
        setCams(disponibles);
        setCamIdx(trasera >= 0 ? trasera : 0);
      } catch {
        if (!cancelled) setError("No se pudo acceder a la cámara.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Iniciar/reiniciar con la cámara seleccionada. Reusa una sola instancia y
  //    detiene la anterior (await) antes de arrancar, para no solaparlas.
  useEffect(() => {
    const camId = cams[camIdx]?.id;
    if (!camId) return;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (cancelled) return;
        if (!scannerRef.current) {
          scannerRef.current = new mod.Html5Qrcode(containerId);
        }
        const scanner = scannerRef.current;
        if (startedRef.current) {
          try {
            await scanner.stop();
          } catch {
            /* ya estaba detenida */
          }
          startedRef.current = false;
        }
        if (cancelled) return;
        await scanner.start(
          camId,
          { fps: 10, qrbox: 240 },
          (decoded) => onDetectRef.current(decoded),
          () => {}
        );
        startedRef.current = true;
      } catch {
        if (!cancelled) setError("No se pudo iniciar la cámara.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cams, camIdx, containerId]);

  // Cleanup al desmontar: detener y limpiar la instancia.
  useEffect(() => {
    return () => {
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s && startedRef.current) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {});
      }
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-sm">
      <div id={containerId} className="overflow-hidden rounded-xl" />
      {cams.length > 1 && (
        <button
          type="button"
          onClick={() => setCamIdx((i) => (i + 1) % cams.length)}
          className="mx-auto mt-2 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary"
        >
          <LuArrowLeftRight className="h-3.5 w-3.5" /> Cambiar cámara
        </button>
      )}
      {error && <p className="mt-2 text-center text-sm text-danger">{error}</p>}
    </div>
  );
}
