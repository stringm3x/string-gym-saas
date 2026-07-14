"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuArrowRight, LuArrowLeft, LuRefreshCw } from "react-icons/lu";

/** Segundos entre reenvíos de código (coincide con el throttle del backend). */
const REENVIO_SEG = 60;
import {
  solicitarCodigoAction,
  verificarCodigoAction,
} from "@/app/portal/[slug]/login/actions";

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
    "w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand-green";

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
      <div className="mb-5 text-center">
        <p className="font-display text-xl uppercase tracking-wide text-text-primary">
          {gymNombre}
        </p>
        <p className="mt-1 text-xs text-text-secondary">Portal del miembro</p>
      </div>

      {paso === "id" ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Teléfono o correo
            </label>
            <input
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
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Recibir código por
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["email", "whatsapp"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCanal(c)}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                      canal === c
                        ? "border-brand-green bg-brand-green/10 text-brand-green"
                        : "border-border bg-bg text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {c === "email" ? "Correo" : "WhatsApp"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
          <button
            type="button"
            disabled={pending || !identificador.trim()}
            onClick={solicitar}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Enviando…" : "Enviar código"}
            <LuArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-text-secondary">
            Enviamos un código a{" "}
            <b className="text-text-primary">{destinoMask}</b>. Vence en 10
            minutos.
          </p>
          <input
            type="text"
            inputMode="numeric"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && verificar()}
            placeholder="______"
            className={`${inputClass} text-center text-lg tracking-[0.5em]`}
            autoFocus
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <button
            type="button"
            disabled={pending || codigo.length !== 6}
            onClick={verificar}
            className="w-full rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Verificando…" : "Entrar"}
          </button>

          {reenvioEn > 0 ? (
            <p className="text-center text-xs text-text-muted">
              ¿No llegó? Reenviar en {reenvioEn}s
            </p>
          ) : (
            <button
              type="button"
              onClick={reenviar}
              disabled={pending}
              className="inline-flex w-full items-center justify-center gap-1.5 text-xs font-medium text-brand-green transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              <LuRefreshCw className="h-3.5 w-3.5" />
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
            className="inline-flex w-full items-center justify-center gap-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            <LuArrowLeft className="h-3.5 w-3.5" /> Usar otro dato
          </button>
        </div>
      )}
    </div>
  );
}
