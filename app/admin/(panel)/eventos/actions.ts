"use server";

import { adminAction } from "@/lib/authz";
import {
  getAdminEventosLog,
  type EventosLogFilters,
} from "@/lib/queries/admin.queries";

function csvCell(v: unknown): string {
  const s =
    v === null || v === undefined
      ? ""
      : typeof v === "object"
        ? JSON.stringify(v)
        : String(v);
  // Escapar comillas y envolver si hay coma/comilla/salto de línea.
  const escaped = s.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

/**
 * Genera un CSV con TODOS los eventos que coincidan con los filtros
 * (sin paginar). La RLS de admin_events acota además la lectura.
 */
export const exportEventosCsv = adminAction(
  "admin.exportar_eventos",
  {},
  async (
    _ctx,
    filters: EventosLogFilters
  ): Promise<{ ok: boolean; csv?: string; error?: string }> => {
    try {
      const { rows } = await getAdminEventosLog(filters, 1, 10_000);
      const header = ["fecha", "admin", "accion", "tenant", "metadata"];
      const lines = [header.join(",")];
      for (const e of rows) {
        lines.push(
          [
            csvCell(new Date(e.created_at).toISOString()),
            csvCell(e.admin_email),
            csvCell(e.accion),
            csvCell(e.tenant_nombre ?? ""),
            csvCell(e.metadata),
          ].join(",")
        );
      }
      return { ok: true, csv: lines.join("\n") };
    } catch {
      return { ok: false, error: "No se pudo exportar." };
    }
  }
);
