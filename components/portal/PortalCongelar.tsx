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
          : "Solicitud enviada. Tu gym la revisará.",
      });
      setAbierto(false);
      router.refresh();
    });
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:border-brand-green focus:outline-none";

  if (pendiente) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-4 text-sm text-text-secondary">
        <LuSnowflake className="mb-1 inline h-4 w-4 text-text-muted" /> Tienes una
        solicitud de congelación pendiente de aprobación.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-primary transition-colors hover:text-brand-green"
        >
          <LuSnowflake className="h-4 w-4" /> Congelar mi membresía
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-text-secondary">
            Elige el período de pausa. Tu vigencia se recorre esos días.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] uppercase tracking-widest text-text-muted">
              Inicio
              <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={inputCls} />
            </label>
            <label className="text-[11px] uppercase tracking-widest text-text-muted">
              Fin
              <input type="date" value={fin} min={inicio} onChange={(e) => setFin(e.target.value)} className={inputCls} />
            </label>
          </div>
          {msg && (
            <p className={`text-xs ${msg.ok ? "text-brand-green" : "text-danger"}`}>
              {msg.text}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={enviar}
              disabled={isPending}
              className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-bg disabled:opacity-50"
            >
              {isPending ? "Enviando…" : "Solicitar"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
