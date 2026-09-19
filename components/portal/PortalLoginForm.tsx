"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuArrowRight, LuArrowLeft, LuRefreshCw } from "react-icons/lu";
import {
  solicitarCodigoAction,
  verificarCodigoAction,
} from "@/app/portal/[slug]/login/actions";

/** Segundos entre reenvíos de código (coincide con el throttle del backend). */
const REENVIO_SEG = 60;

/**
 * Acceso del socio por código de un solo uso. Tarjeta con sombra dura en el
 * color del gimnasio; el nombre del gym es el titular (Anton): aquí el socio
 * está conociendo el portal, no trabajando.
 */
export function PortalLoginForm({
  slug,
  gymNombre,
  puedeWhatsapp = false,
}: {
  slug: string;
  gymNombre: string;
  puedeWhatsapp?: boolean;
}) {
  const router = useRouter();
  const [paso, setPaso] = useState<"id" | "codigo">("id");
  const [identificador, setIdentificador] = useState("");
  const [codigo, setCodigo] = useState("");
  const [canal, setCanal] = useState<"email" | "whatsapp">("email");
  const [destinoMask, setDestinoMask] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reenvioEn, setReenvioEn] = useState(0);
  const [pending, start] = useTransition();

  // Cuenta regresiva del reenvío mientras estamos en el paso del código.
  useEffect(() => {
    if (paso !== "codigo") return;
    const t = setInterval(() => {
      setReenvioEn((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [paso]);

  function solicitar() {
    setError(null);
    start(async () => {
      const r = await solicitarCodigoAction(slug, identificador, canal);
      if (!r.ok) {
        setError(r.error ?? "Error");
        return;
      }
      setDestinoMask(r.destinoMask ?? "");
      setReenvioEn(REENVIO_SEG);
      setPaso("codigo");
    });
  }

  function reenviar() {
    if (reenvioEn > 0) return;
    setError(null);
    start(async () => {
      const r = await solicitarCodigoAction(slug, identificador, canal);
      if (!r.ok) {
        setError(r.error ?? "No se pudo reenviar. Intenta de nuevo.");
        return;
      }
      setCodigo("");
      setReenvioEn(REENVIO_SEG);
    });
  }

  function verificar() {
    setError(null);
    start(async () => {
      const r = await verificarCodigoAction(slug, identificador, codigo);
      if (!r.ok) {
        setError(r.error ?? "Error");
        return;
      }
      router.push(`/portal/${slug}`);
    });
  }

  const inputClass =
    "h-12 w-full rounded border border-border bg-bg px-3 text-base text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none";
  const labelClass = "mb-2 block font-mono text-etiqueta uppercase text-text-secondary";
  const primaryClass =
    "inline-flex h-12 w-full items-center justify-center gap-2 bg-brand-green px-4 text-base font-semibold text-on-brand transition-colors hover:bg-brand-green/90 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="w-full max-w-sm border border-border bg-surface p-8 shadow-hard-green">
      <div className="mb-8 flex flex-col gap-3">
        <p className="font-mono text-etiqueta uppercase text-brand-green">
          Portal del socio
        </p>
        <h1 className="font-display text-titular-m uppercase text-text-primary">
          {gymNombre}
        </h1>
      </div>

      {paso === "id" ? (
        <div className="flex flex-col gap-5">
          <div>
            <label htmlFor="portal-id" className={labelClass}>
              Teléfono o correo
            </label>
            <input
              id="portal-id"
              type="text"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && solicitar()}
              placeholder="55 1234 5678 o tu@correo.com"
              className={inputClass}
              autoFocus
            />
          </div>
          {puedeWhatsapp && (
            <div>
              <p className={labelClass}>Recibir código por</p>
              <div className="grid grid-cols-2 gap-2">
                {(["email", "whatsapp"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCanal(c)}
                    aria-pressed={canal === c}
                    className={`h-11 border text-sm transition-colors ${
                      canal === c
                        ? "border-brand-green bg-brand-green/10 text-brand-green"
                        : "border-border text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {c === "email" ? "Correo" : "WhatsApp"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={pending || !identificador.trim()}
            onClick={solicitar}
            className={primaryClass}
          >
            {pending ? "Enviando…" : "Enviar código"}
            <LuArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-text-secondary">
            Enviamos un código a{" "}
            <b className="font-semibold text-text-primary">{destinoMask}</b>.
            Vence en 10 minutos.
          </p>
          <div>
            <label htmlFor="portal-codigo" className={labelClass}>
              Código de 6 dígitos
            </label>
            <input
              id="portal-codigo"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={codigo}
              onChange={(e) =>
                setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              onKeyDown={(e) => e.key === "Enter" && verificar()}
              placeholder="______"
              className={`${inputClass} h-14 text-center font-mono text-2xl tracking-[0.5em]`}
              autoFocus
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={pending || codigo.length !== 6}
            onClick={verificar}
            className={primaryClass}
          >
            {pending ? "Verificando…" : "Entrar"}
          </button>

          {reenvioEn > 0 ? (
            <p className="text-center font-mono text-etiqueta uppercase text-text-muted">
              ¿No llegó? Reenviar en {reenvioEn}s
            </p>
          ) : (
            <button
              type="button"
              onClick={reenviar}
              disabled={pending}
              className="inline-flex h-10 w-full items-center justify-center gap-2 text-sm text-brand-green underline-offset-4 hover:underline disabled:opacity-50"
            >
              <LuRefreshCw className="h-4 w-4" aria-hidden="true" />
              {pending ? "Reenviando…" : "Reenviar código"}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setPaso("id");
              setCodigo("");
              setError(null);
            }}
            className="inline-flex h-10 w-full items-center justify-center gap-2 text-sm text-text-secondary hover:text-text-primary"
          >
            <LuArrowLeft className="h-4 w-4" aria-hidden="true" /> Usar otro dato
          </button>
        </div>
      )}
    </div>
  );
}
