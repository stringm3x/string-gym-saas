"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuCopy, LuCheck, LuEye, LuEyeOff, LuRefreshCw, LuBookOpen } from "react-icons/lu";
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
    <div className="space-y-5">
      {/* Key */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">API key</h3>
          <Link
            href="/api-docs"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary"
          >
            <LuBookOpen className="h-3.5 w-3.5" /> Documentación
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="flex-1 min-w-[220px] overflow-x-auto rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs text-text-primary">
            {revealed ? key : mask(key)}
          </code>
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            title={revealed ? "Ocultar" : "Mostrar"}
            className="rounded-lg border border-border p-2 text-text-secondary hover:text-text-primary"
          >
            {revealed ? (
              <LuEyeOff className="h-4 w-4" />
            ) : (
              <LuEye className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={copiar}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
          >
            {copied ? (
              <LuCheck className="h-3.5 w-3.5 text-brand-green" />
            ) : (
              <LuCopy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={regenerar}
            className="inline-flex items-center gap-1.5 rounded-lg border border-danger/40 px-3 py-2 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
          >
            <LuRefreshCw className="h-3.5 w-3.5" /> Regenerar
          </button>
        </div>

        {err && <p className="mt-2 text-xs text-danger">{err}</p>}
        <p className="mt-2 text-[11px] text-text-muted">
          Inclúyela en cada request como{" "}
          <code className="font-mono">Authorization: Bearer {"{key}"}</code>.
          No la compartas públicamente.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wide text-text-muted">
            Requests (30 días)
          </p>
          <p className="mt-1 text-lg font-semibold text-text-primary">
            {requestsMes}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[11px] uppercase tracking-wide text-text-muted">
            Último uso
          </p>
          <p className="mt-1 text-sm text-text-primary">
            {fechaHora(ultimoUso)}
          </p>
        </div>
      </div>

      {/* Log */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">
          Últimas requests
        </h3>
        {log.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-xs text-text-secondary">
            Sin actividad todavía.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface text-left uppercase tracking-wide text-text-muted">
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Método</th>
                  <th className="px-3 py-2 font-medium">Endpoint</th>
                  <th className="px-3 py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {log.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-text-secondary">
                      {fechaHora(r.created_at)}
                    </td>
                    <td className="px-3 py-2 font-mono text-text-secondary">
                      {r.method}
                    </td>
                    <td className="px-3 py-2 font-mono text-text-primary">
                      {r.endpoint}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${
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
      </div>
    </div>
  );
}
