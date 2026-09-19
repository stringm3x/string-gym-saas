"use client";

import { LuDownload } from "react-icons/lu";
import { descargarMiembrosCsv, type MiembroCsvRow } from "@/lib/utils/miembros-csv";

/** "Exportación de datos" (Starter): descarga la lista visible como CSV. */
export function ExportarMiembrosCsv({ miembros }: { miembros: MiembroCsvRow[] }) {
  return (
    <button
      type="button"
      onClick={() => descargarMiembrosCsv(miembros)}
      disabled={miembros.length === 0}
      className="inline-flex h-9 items-center gap-2 border border-border px-3 text-sm text-text-primary transition-colors hover:border-text-secondary disabled:opacity-40"
    >
      <LuDownload className="h-4 w-4" aria-hidden="true" />
      Exportar CSV
    </button>
  );
}
