"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { LuChevronLeft, LuChevronRight, LuSearch } from "react-icons/lu";
import type { EventoLogRow } from "@/lib/queries/admin.queries";
import { ACCION_LABEL } from "@/components/admin/AuditLogTable";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { exportEventosCsv } from "@/app/admin/(panel)/eventos/actions";
import { TZ_MX } from "@/lib/utils/dates";

// Campo crudo del sistema: 44px, radio de 4px, fondo bg.
const FIELD =
  "h-11 rounded border border-border bg-bg px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-green focus:outline-none";
const TH = "px-4 py-3 font-normal";

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
  const hayFiltros = ["accion", "tenant", "desde", "hasta"].some((k) =>
    params.get(k)
  );

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
      a.download = "bitacora.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={params.get("accion") ?? ""}
          onChange={(e) => setParam({ accion: e.target.value })}
          aria-label="Acción"
          className={FIELD}
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
          aria-label="Gimnasio"
          className={FIELD}
        >
          <option value="">Gimnasio: todos</option>
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
          className={`${FIELD} font-mono tabular-nums`}
          aria-label="Desde"
        />
        <input
          type="date"
          value={params.get("hasta") ?? ""}
          onChange={(e) => setParam({ hasta: e.target.value })}
          className={`${FIELD} font-mono tabular-nums`}
          aria-label="Hasta"
        />

        <Button
          type="button"
          variant="secondary"
          onClick={exportar}
          loading={exporting}
          className="ml-auto"
        >
          {exporting ? "Exportando…" : "Exportar CSV"}
        </Button>
      </div>

      {err && (
        <p role="alert" className="text-sm text-danger">
          {err}
        </p>
      )}

      {/* Tabla */}
      {rows.length === 0 ? (
        <EmptyState
          icon={<LuSearch />}
          title="Sin acciones"
          description="Ninguna acción administrativa coincide con estos filtros."
          action={
            hayFiltros ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/admin/eventos")}
              >
                Quitar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-etiqueta uppercase text-text-muted">
                <th className={TH}>Fecha</th>
                <th className={TH}>Admin</th>
                <th className={TH}>Acción</th>
                <th className={TH}>Gimnasio</th>
                <th className={TH}>Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-dato tabular-nums text-text-secondary">
                    {fechaHora(e.created_at)}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {e.admin_email}
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {ACCION_LABEL[e.accion] ?? e.accion}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {e.tenant_nombre ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {resumenMeta(e.metadata) || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-xs tabular-nums text-text-secondary">
          {total} {total === 1 ? "acción" : "acciones"} · página {page}/
          {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setParam({ page: String(page - 1) })}
            leftIcon={<LuChevronLeft className="h-4 w-4" />}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setParam({ page: String(page + 1) })}
            rightIcon={<LuChevronRight className="h-4 w-4" />}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
