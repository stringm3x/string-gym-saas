"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuCopy, LuCheck, LuEye, LuEyeOff, LuRefreshCw, LuBookOpen } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { regenerarApiKeyAction } from "@/app/(tenant)/[slug]/configuracion/api/actions";
import type { ApiLogRow } from "@/lib/queries/api-keys.queries";
import { TZ_MX } from "@/lib/utils/dates";

function mask(key: string): string {
  if (key.length < 18) return key;
  return `${key.slice(0, 12)}${"•".repeat(10)}${key.slice(-4)}`;
}

function fechaHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: TZ_MX,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ApiKeyPanel({
  apiKey,
  ultimoUso,
  requestsMes,
  log,
}: {
  apiKey: string;
  ultimoUso: string | null;
  requestsMes: number;
  log: ApiLogRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [key, setKey] = useState(apiKey);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function copiar() {
    navigator.clipboard.writeText(key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function regenerar() {
    if (
      !confirm(
        "¿Regenerar la API key? La clave anterior dejará de funcionar de inmediato."
      )
    )
      return;
    setErr(null);
    start(async () => {
      const r = await regenerarApiKeyAction();
      if (!r.ok || !r.apiKey) {
        setErr(r.error ?? "No se pudo regenerar.");
        return;
      }
      setKey(r.apiKey);
      setRevealed(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Key */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-mono text-etiqueta uppercase text-text-secondary">
            API key
          </h4>
          <Link
            href="/api-docs"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary underline-offset-4 transition-colors hover:text-brand-green hover:underline"
          >
            <LuBookOpen className="h-4 w-4" aria-hidden="true" /> Documentación
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <code className="flex h-11 min-w-[220px] flex-1 items-center overflow-x-auto rounded border border-border bg-bg px-3 font-mono text-sm text-text-primary">
            {revealed ? key : mask(key)}
          </code>
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Ocultar API key" : "Mostrar API key"}
            aria-pressed={revealed}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-border text-text-secondary transition-colors hover:border-text-secondary hover:text-text-primary"
          >
            {revealed ? (
              <LuEyeOff className="h-4 w-4" />
            ) : (
              <LuEye className="h-4 w-4" />
            )}
          </button>
          <Button
            type="button"
            variant="secondary"
            onClick={copiar}
            leftIcon={
              copied ? (
                <LuCheck className="h-4 w-4 text-brand-green" />
              ) : (
                <LuCopy className="h-4 w-4" />
              )
            }
          >
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={pending}
            onClick={regenerar}
            leftIcon={<LuRefreshCw className="h-4 w-4" />}
            className="border-danger/40 text-danger hover:border-danger"
          >
            Regenerar
          </Button>
        </div>

        {err && (
          <p role="alert" className="text-xs text-danger">
            {err}
          </p>
        )}
        <p className="text-xs text-text-muted">
          Inclúyela en cada solicitud como{" "}
          <code className="font-mono">Authorization: Bearer {"{key}"}</code>.
          No la compartas públicamente.
        </p>
      </section>

      {/* Cifras de uso */}
      <div className="grid grid-cols-2 gap-4 border-t border-border pt-6">
        <div className="border border-border bg-bg p-4">
          <p className="font-mono text-etiqueta uppercase text-text-secondary">
            Solicitudes (30 días)
          </p>
          <p className="mt-2 font-mono text-cifra font-bold tabular-nums text-text-primary">
            {requestsMes.toLocaleString("es-MX")}
          </p>
        </div>
        <div className="border border-border bg-bg p-4">
          <p className="font-mono text-etiqueta uppercase text-text-secondary">
            Último uso
          </p>
          <p className="mt-2 font-mono text-dato tabular-nums text-text-primary">
            {fechaHora(ultimoUso)}
          </p>
        </div>
      </div>

      {/* Registro */}
      <section className="space-y-3 border-t border-border pt-6">
        <h4 className="text-base font-semibold text-text-primary">
          Últimas solicitudes
        </h4>
        {log.length === 0 ? (
          <p className="border border-border bg-bg px-5 py-8 text-center text-sm text-text-secondary">
            Sin actividad todavía.
          </p>
        ) : (
          <div className="overflow-x-auto border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <Th>Fecha</Th>
                  <Th>Método</Th>
                  <Th>Endpoint</Th>
                  <Th className="text-right">Estado</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {log.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-dato tabular-nums text-text-secondary">
                      {fechaHora(r.created_at)}
                    </td>
                    <td className="px-4 py-3 font-mono text-dato text-text-secondary">
                      {r.method}
                    </td>
                    <td className="px-4 py-3 font-mono text-dato text-text-primary">
                      {r.endpoint}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-dato font-bold tabular-nums ${
                        r.status_code < 400
                          ? "text-brand-green"
                          : r.status_code < 500
                            ? "text-warning"
                            : "text-danger"
                      }`}
                    >
                      {r.status_code}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 font-mono text-etiqueta font-normal uppercase text-text-muted ${className}`}
    >
      {children}
    </th>
  );
}
