"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { LuCamera, LuKeyboard } from "react-icons/lu";
import { KioscoMarco, QrPictograma } from "./KioscoMarco";

const QrCameraScanner = dynamic(
  () => import("@/components/checkins/QrCameraScanner"),
  { ssr: false }
);

/** Paso de identificación por QR reutilizable (Comprar / Pagar membresía). */
export function KioscoScan({
  titulo,
  onToken,
  pending,
  error,
}: {
  titulo: string;
  onToken: (token: string) => void;
  pending?: boolean;
  error?: string | null;
}) {
  const [modo, setModo] = useState<"lector" | "camara">("lector");
  const [token, setToken] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function focus() {
    if (modo === "lector") inputRef.current?.focus();
  }

  useEffect(() => {
    focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  function submit(value: string) {
    const v = value.trim();
    if (!v || pending) return;
    onToken(v);
    setToken("");
  }

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-10 lg:flex-row lg:justify-center lg:gap-24">
      <div className="flex max-w-[480px] flex-col gap-6 text-center lg:text-left">
        <h2 className="font-display text-[56px] uppercase leading-[52px] text-text-primary sm:text-[72px] sm:leading-[66px]">
          {titulo}
        </h2>
        <p className="text-xl leading-8 text-text-secondary">
          Primero identifícate con tu QR.
        </p>
        {error && (
          <p role="alert" className="text-xl font-semibold text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-center lg:justify-start">
          <button
            type="button"
            onClick={() => setModo(modo === "lector" ? "camara" : "lector")}
            className="inline-flex h-12 items-center gap-2 border border-border px-5 text-base text-text-secondary transition-colors hover:border-text-secondary hover:text-text-primary"
          >
            {modo === "lector" ? (
              <>
                <LuCamera className="h-5 w-5" aria-hidden="true" /> Usar cámara
              </>
            ) : (
              <>
                <LuKeyboard className="h-5 w-5" aria-hidden="true" /> Usar lector
              </>
            )}
          </button>
        </div>
      </div>

      <KioscoMarco>
        {modo === "camara" ? (
          <QrCameraScanner onDetect={submit} />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(token);
            }}
            className="flex w-full flex-col items-center gap-5"
          >
            <QrPictograma className="h-24 w-24 text-text-muted" />
            <input
              ref={inputRef}
              autoFocus
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onBlur={() => setTimeout(focus, 50)}
              placeholder="Escanea o escribe tu código…"
              aria-label="Código del socio"
              className="h-12 w-full rounded border border-border bg-bg px-3 text-center text-base text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
            />
            <p
              className="h-5 font-mono text-etiqueta uppercase text-text-muted"
              aria-live="polite"
            >
              {pending ? "Verificando…" : ""}
            </p>
          </form>
        )}
      </KioscoMarco>
    </div>
  );
}
