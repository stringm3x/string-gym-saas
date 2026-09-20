"use server";

import { panelAction } from "@/lib/authz";
import { getReporteFinanciero } from "@/lib/queries/negocio.queries";

/** Genera el CSV del reporte financiero del período. */
export const getReporteCsvAction = panelAction(
  "reportes.csv",
  {},
  async (
    tenant,
    desde: string,
    hasta: string
  ): Promise<{ ok: boolean; error?: string; csv?: string }> => {
    const r = await getReporteFinanciero(tenant.id, desde, hasta);
    const rows: (string | number)[][] = [
      ["Reporte financiero", `${r.desde} a ${r.hasta}`],
      [],
      ["Ingresos por método"],
      ["Efectivo", r.ingresosPorMetodo.efectivo],
      ["Tarjeta", r.ingresosPorMetodo.tarjeta],
      ["Transferencia", r.ingresosPorMetodo.transferencia],
      ["Total ingresos", r.ingresosPorMetodo.total],
      [],
      ["Ingresos por concepto"],
      ["Membresías", r.ingresosPorConcepto.membresia],
      ["Productos", r.ingresosPorConcepto.producto],
      ["Visitas", r.ingresosPorConcepto.visita],
      ["Otros", r.ingresosPorConcepto.otro],
      [],
      ["Reembolsos y notas de crédito"],
      ["Reembolsos en efectivo", r.reembolsosEfectivo],
      ["Reembolsos tarjeta/transferencia", r.reembolsosOtros],
      ["Notas de crédito emitidas", r.notasCredito],
      [],
      ["Cortes de caja"],
      ["Cortes cerrados", r.cortes.cantidad],
      ["Diferencia acumulada", r.cortes.diferencia],
      [],
      ["Ingreso neto (ingresos - reembolsos)", r.ingresoNeto],
    ];

    const csv = rows
      .map((row) =>
        row
          .map((c) => {
            const s = String(c);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      )
      .join("\r\n");

    return { ok: true, csv: "﻿" + csv };
  }
);
