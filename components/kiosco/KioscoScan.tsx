"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { LuCamera, LuKeyboard } from "react-icons/lu";

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
    <div className="flex w-full max-w-2xl flex-col items-center gap-8">
      <p className="text-center text-3xl font-semibold text-text-primary">
        {titulo}
      </p>

      {modo === "camara" ? (
        <QrCameraScanner onDetect={submit} />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(token);
          }}
          className="w-full max-w-lg"
        >
          <input
            ref={inputRef}
            autoFocus
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onBlur={() => setTimeout(focus, 50)}
            placeholder="Escanea o escribe tu código…"
            className="w-full rounded-2xl border border-border bg-surface px-6 py-6 text-center text-2xl text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
          />
          {pending && (
            <p className="mt-4 text-center text-lg text-text-muted">
              Verificando…
            </p>
          )}
        </form>
      )}

      {error && (
        <p className="text-center text-xl font-semibold text-danger">{error}</p>
      )}

      <button
        type="button"
        onClick={() => setModo(modo === "lector" ? "camara" : "lector")}
        className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary"
      >
        {modo === "lector" ? (
          <>
            <LuCamera className="h-4 w-4" /> Usar cámara
          </>
        ) : (
          <>
            <LuKeyboard className="h-4 w-4" /> Usar lector bluetooth
          </>
        )}
      </button>
    </div>
  );
}
