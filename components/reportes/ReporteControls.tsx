"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LuPrinter, LuDownload } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
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

  // Fechas en mono: son datos, como en las tablas.
  const inputCls =
    "h-11 w-full rounded border border-border bg-bg px-3 font-mono text-sm tabular-nums text-text-primary focus:border-brand-green focus:outline-none";

  return (
    <div className="flex flex-wrap items-end gap-3 print:hidden">
      <div className="space-y-2">
        <Label htmlFor="reporte-desde">Desde</Label>
        <input
          id="reporte-desde"
          type="date"
          value={d}
          onChange={(e) => setD(e.target.value)}
          className={inputCls}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reporte-hasta">Hasta</Label>
        <input
          id="reporte-hasta"
          type="date"
          value={h}
          onChange={(e) => setH(e.target.value)}
          className={inputCls}
        />
      </div>
      <Button type="button" variant="secondary" onClick={aplicar}>
        Aplicar
      </Button>
      <div className="ml-auto flex gap-3">
        <Button
          type="button"
          variant="secondary"
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
          Imprimir / guardar PDF
        </Button>
      </div>
    </div>
  );
}
