"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { agregarNotaInternaAction } from "@/app/admin/(panel)/tenants/[tenantId]/actions";
import type { TenantNota } from "@/lib/queries/admin.queries";
import { TZ_MX } from "@/lib/utils/dates";

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: TZ_MX,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotasInternas({
  tenantId,
  notas,
}: {
  tenantId: string;
  notas: TenantNota[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    setErr(null);
    start(async () => {
      const r = await agregarNotaInternaAction(tenantId, text);
      if (r.ok) {
        setText("");
        router.refresh();
      } else {
        setErr(r.error ?? "Error");
      }
    });
  }

  return (
    <section className="card-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold text-text-primary">
          Notas internas
        </h3>
        <span className="font-mono text-etiqueta text-text-muted">
          {notas.length}
        </span>
      </div>

      <div className="space-y-3 p-5">
        <p className="text-sm text-text-muted">
          Solo las ven los administradores de STRING. El cliente nunca las ve.
        </p>
        <label htmlFor="nota-interna" className="sr-only">
          Nueva nota
        </label>
        <textarea
          id="nota-interna"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Escribe una nota…"
          className="w-full rounded border border-border bg-bg px-3 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
        />
        {err && (
          <p role="alert" className="text-sm text-danger">
            {err}
          </p>
        )}
        <Button
          type="button"
          disabled={!text.trim()}
          loading={pending}
          onClick={submit}
        >
          {pending ? "Guardando…" : "Agregar nota"}
        </Button>
      </div>

      {notas.length > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {notas.map((n) => (
            <li key={n.id} className="px-5 py-4">
              <p className="whitespace-pre-wrap text-sm text-text-primary">
                {n.nota}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {n.admin_email} ·{" "}
                <span className="font-mono tabular-nums">
                  {fechaHora(n.created_at)}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
