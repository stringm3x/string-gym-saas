"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">
        Notas internas
      </h3>
      <p className="text-[11px] text-text-muted">
        Solo visibles para admins de STRING. El cliente nunca las ve.
      </p>

      <div className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Escribe una nota…"
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none"
        />
        {err && <p className="text-xs text-danger">{err}</p>}
        <button
          type="button"
          disabled={pending || !text.trim()}
          onClick={submit}
          className="rounded-lg bg-brand-green px-3 py-2 text-xs font-semibold text-bg hover:bg-brand-green/90 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Agregar nota"}
        </button>
      </div>

      {notas.length > 0 && (
        <ul className="space-y-2">
          {notas.map((n) => (
            <li
              key={n.id}
              className="rounded-lg border border-border bg-surface px-3 py-2"
            >
              <p className="whitespace-pre-wrap text-xs text-text-primary">
                {n.nota}
              </p>
              <p className="mt-1 text-[10px] text-text-muted">
                {n.admin_email} · {fechaHora(n.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
