"use client";

import { useState, useTransition, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { LuCopy, LuCheck, LuRefreshCw } from "react-icons/lu";
import { FaWhatsapp } from "react-icons/fa";
import { Button } from "@/components/ui/Button";
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
    <section className="card-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-text-primary">Acceso QR</h3>
      </div>
      <div className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-start">
        <div className="shrink-0 bg-paper p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Código QR" className="h-36 w-36" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="font-mono text-etiqueta uppercase text-text-secondary">
            Link público del QR
          </p>
          <code className="block overflow-x-auto border border-border bg-bg px-3 py-2 font-mono text-dato text-text-secondary">
            {publicUrl()}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={copiar}
              leftIcon={
                copied ? (
                  <LuCheck className="h-4 w-4 text-brand-green" />
                ) : (
                  <LuCopy className="h-4 w-4" />
                )
              }
            >
              {copied ? "Copiado" : "Copiar link"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={whatsapp}
              leftIcon={<FaWhatsapp className="h-4 w-4" />}
            >
              WhatsApp
            </Button>
            {canRegenerar && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={pending}
                onClick={regenerar}
                leftIcon={<LuRefreshCw className="h-4 w-4" />}
                className="border-danger/40 text-danger hover:border-danger"
              >
                Regenerar
              </Button>
            )}
          </div>
          {err && (
            <p role="alert" className="text-sm text-danger">
              {err}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
