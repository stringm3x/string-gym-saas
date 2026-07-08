"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useTransition } from "react";
import { LuCamera, LuKeyboard, LuCircleCheck, LuCircleX } from "react-icons/lu";
import {
  checkInKioscoAction,
  actualizarTelefonoKioscoAction,
  type KioscoResult,
  type KioscoError,
} from "@/app/kiosco/[slug]/actions";

const QrCameraScanner = dynamic(
  () => import("@/components/checkins/QrCameraScanner"),
  { ssr: false }
);

const ERROR_MSG: Record<KioscoError, string> = {
  QR_NO_ENCONTRADO: "QR no válido",
  MIEMBRO_ARCHIVADO: "Cuenta inactiva",
  MEMBRESIA_VENCIDA: "Membresía vencida",
  NO_DISPONIBLE: "No disponible",
  ERROR: "No se pudo registrar",
};

export function KioscoDisplay({
  slug,
  gymNombre,
  logoUrl,
}: {
  slug: string;
  gymNombre: string;
  logoUrl: string | null;
}) {
  const [modo, setModo] = useState<"lector" | "camara">("lector");
  const [token, setToken] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<KioscoResult | null>(null);
  const [telInput, setTelInput] = useState("");
  const [savingTel, startSaveTel] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const lockRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function focusInput() {
    if (modo === "lector") inputRef.current?.focus();
  }

  function reset() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setResult(null);
    setTelInput("");
    lockRef.current = false;
    focusInput();
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
      const r = await checkInKioscoAction(slug, t);
      setResult(r);
      setToken("");
      if (timerRef.current) clearTimeout(timerRef.current);
      // Si hay que pedir el teléfono, NO auto-reseteamos: esperamos al miembro.
      const pideContacto = r.success && r.sinContacto;
      if (!pideContacto) {
        timerRef.current = setTimeout(reset, 3000);
      }
    });
  }

  function guardarTelefono(miembroId: string) {
    startSaveTel(async () => {
      await actualizarTelefonoKioscoAction(slug, miembroId, telInput);
      reset();
    });
  }

  const ok = result?.success === true;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-bg px-6">
      {/* Logo / nombre */}
      <div className="absolute top-8 flex flex-col items-center gap-2">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={gymNombre}
            width={300}
            height={96}
            unoptimized
            priority
            className="h-20 w-auto max-w-[300px] object-contain"
          />
        ) : (
          <span className="font-display text-3xl uppercase tracking-wide text-text-primary">
            {gymNombre}
          </span>
        )}
      </div>

      {/* Centro */}
      <div className="flex w-full max-w-2xl flex-col items-center gap-8">
        {result ? (
          <div
            className={`flex w-full flex-col items-center gap-4 rounded-3xl border p-14 text-center ${
              ok
                ? "border-brand-green/40 bg-brand-green/10"
                : "border-danger/40 bg-danger/10"
            }`}
          >
            {ok ? (
              <LuCircleCheck className="h-28 w-28 text-brand-green" />
            ) : (
              <LuCircleX className="h-28 w-28 text-danger" />
            )}
            {ok ? (
              <>
                <p className="text-5xl font-bold text-text-primary">
                  ¡Bienvenido, {result.nombre}!
                </p>
                {result.plan && (
                  <p className="text-xl text-text-secondary">{result.plan}</p>
                )}

                {result.sinContacto && (
                  <div className="mt-6 w-full max-w-md border-t border-brand-green/20 pt-6">
                    <p className="text-lg font-semibold text-text-primary">
                      Actualiza tu contacto para recibir recordatorios
                    </p>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoFocus
                      value={telInput}
                      onChange={(e) =>
                        setTelInput(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      placeholder="¿Cuál es tu WhatsApp? (10 dígitos)"
                      className="mt-3 w-full rounded-xl border border-border bg-bg px-4 py-3 text-center text-2xl tracking-wider text-text-primary focus:border-brand-green focus:outline-none"
                    />
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={reset}
                        disabled={savingTel}
                        className="flex-1 rounded-xl border border-border px-4 py-3 text-lg text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
                      >
                        Ahora no
                      </button>
                      <button
                        type="button"
                        onClick={() => guardarTelefono(result.miembroId)}
                        disabled={savingTel || telInput.length !== 10}
                        className="flex-1 rounded-xl bg-brand-green px-4 py-3 text-lg font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {savingTel ? "Guardando…" : "Guardar"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-5xl font-bold text-danger">
                  {ERROR_MSG[result.error]}
                </p>
                {result.nombre && (
                  <p className="text-2xl text-text-secondary">{result.nombre}</p>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <p className="text-center text-3xl font-semibold text-text-primary">
              Escanea tu QR para registrar tu entrada
            </p>

            {modo === "camara" ? (
              <QrCameraScanner onDetect={procesar} />
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  procesar(token);
                }}
                className="w-full max-w-lg"
              >
                <input
                  ref={inputRef}
                  autoFocus
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onBlur={() => setTimeout(focusInput, 50)}
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
          </>
        )}
      </div>

      {/* Acceso discreto a administración */}
      <Link
        href={`/${slug}/checkins`}
        className="absolute bottom-6 text-xs text-text-muted hover:text-text-secondary"
      >
        Administración
      </Link>
    </div>
  );
}
