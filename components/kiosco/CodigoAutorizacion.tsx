"use client";

import { useEffect, useState } from "react";
import { LuCircleCheck, LuClock, LuCircleAlert } from "react-icons/lu";

function segundosRestantes(expiraAt: string): number {
  return Math.max(0, Math.round((new Date(expiraAt).getTime() - Date.now()) / 1000));
}

/** Pantalla de código de autorización con cuenta regresiva (Comprar / Membresía). */
export function CodigoAutorizacion({
  codigo,
  expiraAt,
  mensaje,
  onReset,
}: {
  codigo: string;
  expiraAt: string;
  mensaje: string;
  onReset: () => void;
}) {
  const [restante, setRestante] = useState(() => segundosRestantes(expiraAt));

  useEffect(() => {
    const id = setInterval(() => setRestante(segundosRestantes(expiraAt)), 1000);
    return () => clearInterval(id);
  }, [expiraAt]);

  const expirado = restante <= 0;
  const mm = Math.floor(restante / 60);
  const ss = String(restante % 60).padStart(2, "0");

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-6 rounded-3xl border border-brand-green/40 bg-brand-green/10 p-12 text-center">
      {expirado ? (
        <>
          <LuCircleAlert className="h-20 w-20 text-danger" />
          <p className="text-3xl font-bold text-danger">El código expiró</p>
          <p className="text-lg text-text-secondary">
            Genera uno nuevo para continuar.
          </p>
        </>
      ) : (
        <>
          <LuCircleCheck className="h-16 w-16 text-brand-green" />
          <p className="text-xl text-text-secondary">{mensaje}</p>
          <div className="rounded-2xl bg-bg px-10 py-6">
            <p className="font-mono text-7xl font-bold tracking-[0.3em] text-text-primary">
              {codigo}
            </p>
          </div>
          <p className="inline-flex items-center gap-2 text-lg text-text-secondary">
            <LuClock className="h-5 w-5" /> Válido por {mm}:{ss}
          </p>
        </>
      )}

      <button
        type="button"
        onClick={onReset}
        className="mt-2 rounded-xl border border-border px-6 py-3 text-lg font-semibold text-text-primary transition-colors hover:border-brand-green"
      >
        {expirado ? "Empezar de nuevo" : "Listo"}
      </button>
    </div>
  );
}
