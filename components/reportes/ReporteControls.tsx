"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuPrinter, LuDownload } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getReporteCsvAction } from "@/app/(tenant)/[slug]/reportes/financiero/actions";

export function ReporteControls({
  slug,
  desde,
  hasta,
}: {
  slug: string;
  desde: string;
  hasta: string;
}) {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [d, setD] = useState(desde);
  const [h, setH] = useState(hasta);
  const [isPending, start] = useTransition();

  function aplicar() {
    router.push(`/${slug}/reportes/financiero?desde=${d}&hasta=${h}`);
  }

  function descargarCsv() {
    start(async () => {
      const r = await getReporteCsvAction(desde, hasta);
      if (!r.ok || !r.csv) {
        toastError("Error", r.error ?? "No se pudo generar el CSV.");
        return;
      }
      const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte-financiero-${desde}_${hasta}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const inputCls =
    "rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:border-brand-green focus:outline-none";

  return (
    <div className="flex flex-wrap items-end gap-2 print:hidden">
      <label className="text-xs text-text-muted">
        <span className="mb-1 block uppercase tracking-widest">Desde</span>
        <input type="date" value={d} onChange={(e) => setD(e.target.value)} className={inputCls} />
      </label>
      <label className="text-xs text-text-muted">
        <span className="mb-1 block uppercase tracking-widest">Hasta</span>
        <input type="date" value={h} onChange={(e) => setH(e.target.value)} className={inputCls} />
      </label>
      <Button type="button" variant="ghost" onClick={aplicar}>
        Aplicar
      </Button>
      <div className="ml-auto flex gap-2">
        <Button
          type="button"
          variant="ghost"
          leftIcon={<LuDownload className="h-4 w-4" />}
          onClick={descargarCsv}
          loading={isPending}
        >
          CSV
        </Button>
        <Button
          type="button"
          leftIcon={<LuPrinter className="h-4 w-4" />}
          onClick={() => window.print()}
        >
          Imprimir / PDF
        </Button>
      </div>
    </div>
  );
}
