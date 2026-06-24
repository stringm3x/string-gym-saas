"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import type { EventoLogRow } from "@/lib/queries/admin.queries";
import { ACCION_LABEL } from "@/components/admin/AuditLogTable";
import { exportEventosCsv } from "@/app/admin/(panel)/eventos/actions";

const SELECT =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-green focus:outline-none";

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resumenMeta(meta: Record<string, unknown>): string {
  return Object.entries(meta ?? {})
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(" · ");
}

interface Props {
  rows: EventoLogRow[];
  total: number;
  page: number;
  pageSize: number;
  tenants: { id: string; nombre: string }[];
}

export function AdminEventosTable({
  rows,
  total,
  page,
  pageSize,
  tenants,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [exporting, startExport] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function setParam(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    // Cualquier cambio de filtro vuelve a la página 1.
    if (!("page" in next)) sp.delete("page");
    router.push(`/admin/eventos?${sp.toString()}`);
  }

  function exportar() {
    setErr(null);
    startExport(async () => {
      const r = await exportEventosCsv({
        accion: params.get("accion") ?? undefined,
        tenantId: params.get("tenant") ?? undefined,
        desde: params.get("desde") ?? undefined,
        hasta: params.get("hasta") ?? undefined,
      });
      if (!r.ok || !r.csv) {
        setErr(r.error ?? "Error al exportar.");
        return;
      }
      const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "audit-log.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={params.get("accion") ?? ""}
          onChange={(e) => setParam({ accion: e.target.value })}
          className={SELECT}
        >
          <option value="">Acción: todas</option>
          {Object.entries(ACCION_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={params.get("tenant") ?? ""}
          onChange={(e) => setParam({ tenant: e.target.value })}
          className={SELECT}
        >
          <option value="">Tenant: todos</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={params.get("desde") ?? ""}
          onChange={(e) => setParam({ desde: e.target.value })}
          className={SELECT}
          aria-label="Desde"
        />
        <input
          type="date"
          value={params.get("hasta") ?? ""}
          onChange={(e) => setParam({ hasta: e.target.value })}
          className={SELECT}
          aria-label="Hasta"
        />

        <button
          type="button"
          onClick={exportar}
          disabled={exporting}
          className="ml-auto rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary disabled:opacity-50"
        >
          {exporting ? "Exportando…" : "Exportar CSV"}
        </button>
      </div>

      {err && <p className="text-xs text-danger">{err}</p>}

      {/* Tabla */}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-text-secondary">
          No hay eventos con estos filtros.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface text-left uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Admin</th>
                <th className="px-3 py-2 font-medium">Acción</th>
                <th className="px-3 py-2 font-medium">Tenant</th>
                <th className="px-3 py-2 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-text-secondary">
                    {fechaHora(e.created_at)}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {e.admin_email}
                  </td>
                  <td className="px-3 py-2 text-text-primary">
                    {ACCION_LABEL[e.accion] ?? e.accion}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {e.tenant_nombre ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-text-muted">
                    {resumenMeta(e.metadata) || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      <div className="flex items-center justify-between text-xs text-text-secondary">
        <span>
          {total} evento{total === 1 ? "" : "s"} · página {page}/{totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setParam({ page: String(page - 1) })}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
          >
            <LuChevronLeft className="h-3.5 w-3.5" /> Anterior
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setParam({ page: String(page + 1) })}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
          >
            Siguiente <LuChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
