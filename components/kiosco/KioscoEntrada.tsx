"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useTransition } from "react";
import { LuCamera, LuKeyboard, LuCircleCheck, LuCircleX } from "react-icons/lu";
import {
  checkInKioscoAction,
  actualizarTelefonoKioscoAction,
  type KioscoResult,
  type KioscoError,
} from "@/app/kiosco/[slug]/actions";
import { KioscoMarco, QrPictograma } from "./KioscoMarco";

const QrCameraScanner = dynamic(
  () => import("@/components/checkins/QrCameraScanner"),
  { ssr: false }
);

const ERROR_MSG: Record<KioscoError, string> = {
  QR_NO_ENCONTRADO: "QR no válido",
  MIEMBRO_ARCHIVADO: "Cuenta inactiva",
  MEMBRESIA_VENCIDA: "Membresía vencida",
  MEMBRESIA_CONGELADA: "Membresía congelada",
  SIN_VISITAS: "Sin visitas disponibles",
  NO_DISPONIBLE: "No disponible",
  ERROR: "No se pudo registrar",
};

export function KioscoEntrada({ slug }: { slug: string }) {
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

  // ── Resultado: pantalla completa, se lee a un metro ──
  if (result) {
    return (
      <div
        role="status"
        className={`flex w-full max-w-3xl flex-col items-center gap-6 border-2 p-10 text-center sm:p-14 ${
          ok ? "border-brand-green bg-brand-green/10" : "border-danger bg-danger/10"
        }`}
      >
        {ok ? (
          <LuCircleCheck className="h-24 w-24 text-brand-green" aria-hidden="true" />
        ) : (
          <LuCircleX className="h-24 w-24 text-danger" aria-hidden="true" />
        )}

        {ok ? (
          <>
            <p className="text-4xl font-semibold leading-tight text-text-primary sm:text-5xl">
              ¡Bienvenido, {result.nombre}!
            </p>
            {result.plan && (
              <p className="font-mono text-[15px] uppercase tracking-[0.16em] text-text-secondary">
                {result.plan}
              </p>
            )}

            {result.sinContacto && (
              <div className="mt-4 w-full max-w-md border-t border-brand-green/40 pt-6">
                <p className="text-xl font-semibold text-text-primary">
                  Déjanos tu WhatsApp para avisarte cuando venza tu membresía
                </p>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoFocus
                  value={telInput}
                  onChange={(e) =>
                    setTelInput(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="10 dígitos"
                  aria-label="Tu WhatsApp, 10 dígitos"
                  className="mt-4 h-16 w-full rounded border border-border bg-bg px-4 text-center font-mono text-3xl tracking-[0.2em] text-text-primary placeholder:tracking-normal placeholder:text-text-muted focus:border-brand-green focus:outline-none"
                />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={reset}
                    disabled={savingTel}
                    className="h-14 border border-border px-4 text-lg text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
                  >
                    Ahora no
                  </button>
                  <button
                    type="button"
                    onClick={() => guardarTelefono(result.miembroId)}
                    disabled={savingTel || telInput.length !== 10}
                    className="h-14 bg-brand-green px-4 text-lg font-semibold text-on-brand transition-colors hover:bg-brand-green/90 disabled:opacity-50"
                  >
                    {savingTel ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-4xl font-semibold leading-tight text-danger sm:text-5xl">
              {ERROR_MSG[result.error]}
            </p>
            {result.nombre && (
              <p className="text-2xl text-text-secondary">{result.nombre}</p>
            )}
            <p className="text-lg text-text-muted">Pasa a recepción.</p>
          </>
        )}
      </div>
    );
  }

  // ── Espera: titular Anton + marco de escaneo ──
  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-10 lg:flex-row lg:justify-center lg:gap-24">
      <div className="flex max-w-[480px] flex-col gap-6 text-center lg:text-left">
        <h1 className="font-display text-[64px] uppercase leading-[58px] text-text-primary sm:text-[80px] sm:leading-[72px] xl:text-[96px] xl:leading-[88px]">
          Escanea
          <br />
          tu código
        </h1>
        <p className="text-xl leading-8 text-text-secondary sm:text-2xl sm:leading-[34px]">
          {modo === "camara"
            ? "Muestra el QR de tu celular a la cámara para registrar tu entrada."
            : "Acerca el QR de tu celular al lector para registrar tu entrada."}
        </p>
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
          <QrCameraScanner onDetect={procesar} />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              procesar(token);
            }}
            className="flex w-full flex-col items-center gap-5"
          >
            <QrPictograma className="h-24 w-24 text-text-muted" />
            <input
              ref={inputRef}
              autoFocus
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onBlur={() => setTimeout(focusInput, 50)}
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
