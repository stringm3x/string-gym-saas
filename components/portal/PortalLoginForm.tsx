"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuArrowRight, LuArrowLeft } from "react-icons/lu";
import {
  solicitarCodigoAction,
  verificarCodigoAction,
} from "@/app/portal/[slug]/login/actions";

export function PortalLoginForm({
  slug,
  gymNombre,
}: {
  slug: string;
  gymNombre: string;
}) {
  const router = useRouter();
  const [paso, setPaso] = useState<"id" | "codigo">("id");
  const [identificador, setIdentificador] = useState("");
  const [codigo, setCodigo] = useState("");
  const [emailMask, setEmailMask] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function solicitar() {
    setError(null);
    start(async () => {
      const r = await solicitarCodigoAction(slug, identificador);
      if (!r.ok) {
        setError(r.error ?? "Error");
        return;
      }
      setEmailMask(r.emailMask ?? "");
      setPaso("codigo");
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
            Enviamos un código a <b className="text-text-primary">{emailMask}</b>.
            Vence en 10 minutos.
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
