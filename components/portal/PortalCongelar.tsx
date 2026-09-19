"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuSnowflake } from "react-icons/lu";
import { solicitarCongelacionAction } from "@/app/portal/[slug]/congelar-actions";

export function PortalCongelar({
  slug,
  pendiente,
}: {
  slug: string;
  pendiente: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, start] = useTransition();

  function enviar() {
    if (!inicio || !fin) {
      setMsg({ ok: false, text: "Indica las fechas de la pausa." });
      return;
    }
    start(async () => {
      const r = await solicitarCongelacionAction(slug, inicio, fin);
      if (!r.ok) {
        setMsg({ ok: false, text: r.error ?? "No se pudo enviar." });
        return;
      }
      setMsg({
        ok: true,
        text: r.aplicada
          ? "Tu membresía quedó congelada."
          : "Solicitud enviada. Tu gimnasio la revisará.",
      });
      setAbierto(false);
      router.refresh();
    });
  }

  const inputCls =
    "mt-2 h-12 w-full rounded border border-border bg-bg px-3 font-mono text-base text-text-primary focus:border-brand-green focus:outline-none";

  if (pendiente) {
    return (
      <section className="flex items-center gap-3 border border-border bg-surface p-5 text-sm text-text-secondary">
        <LuSnowflake className="h-5 w-5 shrink-0 text-text-muted" aria-hidden="true" />
        Tienes una solicitud de congelación pendiente de aprobación.
      </section>
    );
  }

  return (
    <section className="border border-border bg-surface p-5">
      {!abierto ? (
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="font-mono text-etiqueta uppercase text-text-secondary">
              ¿Te vas unos días?
            </p>
            <p className="text-sm text-text-muted">
              Congela tu membresía y tu vigencia se recorre.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="inline-flex h-11 shrink-0 items-center gap-2 border border-border px-4 text-sm text-text-primary transition-colors hover:border-text-secondary"
          >
            <LuSnowflake className="h-4 w-4" aria-hidden="true" /> Congelar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="font-mono text-etiqueta uppercase text-text-secondary">
            Congelar membresía
          </p>
          <p className="text-sm text-text-secondary">
            Elige el periodo de pausa. Tu vigencia se recorre esos días.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="font-mono text-etiqueta uppercase text-text-secondary">
              Inicio
              <input
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="font-mono text-etiqueta uppercase text-text-secondary">
              Fin
              <input
                type="date"
                value={fin}
                min={inicio}
                onChange={(e) => setFin(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
          {msg && (
            <p
              role="status"
              className={`text-sm ${msg.ok ? "text-brand-green" : "text-danger"}`}
            >
              {msg.text}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="inline-flex h-12 items-center justify-center border border-border px-4 text-base text-text-primary transition-colors hover:border-text-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={enviar}
              disabled={isPending}
              className="inline-flex h-12 items-center justify-center bg-brand-green px-4 text-base font-semibold text-on-brand transition-colors hover:bg-brand-green/90 disabled:opacity-50"
            >
              {isPending ? "Enviando…" : "Solicitar"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
