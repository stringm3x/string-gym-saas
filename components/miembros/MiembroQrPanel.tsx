"use client";

import { useState, useTransition, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { LuCopy, LuCheck, LuRefreshCw } from "react-icons/lu";
import { FaWhatsapp } from "react-icons/fa";
import { regenerarQrAction } from "@/app/(tenant)/[slug]/miembros/qr-actions";

// El origin solo existe en el cliente. Lo leemos con useSyncExternalStore para
// que SSR e hidratación coincidan (snapshot de servidor vacío) y evitar el
// mismatch de hidratación al construir el link público absoluto.
const emptySubscribe = () => () => {};

export function MiembroQrPanel({
  qrDataUrl,
  token,
  telefono,
  nombre,
  miembroId,
  canRegenerar,
}: {
  qrDataUrl: string;
  token: string;
  telefono: string | null;
  nombre: string;
  miembroId: string;
  canRegenerar: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const origin = useSyncExternalStore(
    emptySubscribe,
    () => window.location.origin,
    () => ""
  );

  function publicUrl() {
    return `${origin}/qr/${token}`;
  }

  function copiar() {
    navigator.clipboard.writeText(publicUrl()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function whatsapp() {
    const msg = `Hola ${nombre}, este es tu código QR de acceso al gym: ${publicUrl()}`;
    const base = telefono
      ? `https://wa.me/${telefono.replace(/\D/g, "")}`
      : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  function regenerar() {
    if (
      !confirm(
        "¿Regenerar el QR? El código anterior dejará de funcionar de inmediato."
      )
    )
      return;
    setErr(null);
    start(async () => {
      const r = await regenerarQrAction(miembroId);
      if (!r.ok) {
        setErr(r.error ?? "No se pudo regenerar.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">Acceso QR</h3>
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-start">
        <div className="rounded-xl bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Código QR" className="h-36 w-36" />
        </div>

        <div className="flex-1 space-y-2">
          <p className="text-xs text-text-secondary">
            Link público del QR (el miembro lo guarda en favoritos):
          </p>
          <code className="block overflow-x-auto rounded-lg border border-border bg-bg px-2 py-1.5 font-mono text-[11px] text-text-secondary">
            {publicUrl()}
          </code>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copiar}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary"
            >
              {copied ? (
                <LuCheck className="h-3.5 w-3.5 text-brand-green" />
              ) : (
                <LuCopy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copiado" : "Copiar link"}
            </button>
            <button
              type="button"
              onClick={whatsapp}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary"
            >
              <FaWhatsapp className="h-3.5 w-3.5" /> WhatsApp
            </button>
            {canRegenerar && (
              <button
                type="button"
                disabled={pending}
                onClick={regenerar}
                className="inline-flex items-center gap-1.5 rounded-lg border border-danger/40 px-2.5 py-1.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
              >
                <LuRefreshCw className="h-3.5 w-3.5" /> Regenerar
              </button>
            )}
          </div>
          {err && <p className="text-xs text-danger">{err}</p>}
        </div>
      </div>
    </div>
  );
}
