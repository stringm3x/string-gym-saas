"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useTransition } from "react";
import { LuX, LuCamera, LuKeyboard, LuCircleCheck, LuCircleX } from "react-icons/lu";
import {
  checkInPorQrAction,
  type CheckInQrResult,
  type CheckInQrError,
} from "@/app/(tenant)/[slug]/checkins/scanner/actions";

const QrCameraScanner = dynamic(() => import("./QrCameraScanner"), {
  ssr: false,
});

const ERROR_MSG: Record<CheckInQrError, string> = {
  QR_NO_ENCONTRADO: "QR no encontrado",
  MIEMBRO_ARCHIVADO: "Cuenta inactiva",
  MEMBRESIA_VENCIDA: "Membresía vencida",
  MEMBRESIA_CONGELADA: "Membresía congelada",
  SIN_VISITAS: "Sin visitas disponibles",
  ERROR: "No se pudo registrar el check-in",
};

function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function QrScannerDisplay({ slug }: { slug: string }) {
  const [modo, setModo] = useState<"lector" | "camara">("lector");
  const [token, setToken] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<CheckInQrResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lockRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function focusInput() {
    if (modo === "lector") inputRef.current?.focus();
  }

  useEffect(() => {
    focusInput();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, result]);

  function procesar(value: string) {
    const t = value.trim();
    if (!t || lockRef.current || pending) return;
    lockRef.current = true;
    start(async () => {
      const r = await checkInPorQrAction(t);
      setResult(r);
      setToken("");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setResult(null);
        lockRef.current = false;
        focusInput();
      }, 2500);
    });
  }

  const ok = result?.success === true;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      {/* Barra superior */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="font-display text-lg uppercase tracking-wide text-text-primary">
          Escanear QR
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModo(modo === "lector" ? "camara" : "lector")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            {modo === "lector" ? (
              <>
                <LuCamera className="h-3.5 w-3.5" /> Usar cámara
              </>
            ) : (
              <>
                <LuKeyboard className="h-3.5 w-3.5" /> Usar lector
              </>
            )}
          </button>
          <Link
            href={`/${slug}/checkins`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            <LuX className="h-3.5 w-3.5" /> Salir
          </Link>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        {result ? (
          <div
            className={`flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border p-10 text-center ${
              ok
                ? "border-brand-green/40 bg-brand-green/10"
                : "border-danger/40 bg-danger/10"
            }`}
          >
            {ok ? (
              <LuCircleCheck className="h-20 w-20 text-brand-green" />
            ) : (
              <LuCircleX className="h-20 w-20 text-danger" />
            )}
            {ok ? (
              <>
                <p className="text-3xl font-bold text-text-primary">
                  Bienvenido, {result.nombre}
                </p>
                {result.fechaVencimiento && (
                  <p className="text-sm text-text-secondary">
                    Vence: {fechaCorta(result.fechaVencimiento)}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-danger">
                  {ERROR_MSG[result.error]}
                </p>
                {result.nombre && (
                  <p className="text-base text-text-secondary">
                    {result.nombre}
                  </p>
                )}
              </>
            )}
          </div>
        ) : modo === "camara" ? (
          <QrCameraScanner onDetect={procesar} />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              procesar(token);
            }}
            className="w-full max-w-md text-center"
          >
            <p className="mb-4 text-sm text-text-secondary">
              Escanea el QR (lector bluetooth) o escribe el código y presiona
              Enter.
            </p>
            <input
              ref={inputRef}
              autoFocus
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onBlur={() => setTimeout(focusInput, 50)}
              placeholder="Código del QR…"
              className="w-full rounded-xl border border-border bg-surface px-4 py-4 text-center text-lg text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
            />
            {pending && (
              <p className="mt-3 text-sm text-text-muted">Verificando…</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
