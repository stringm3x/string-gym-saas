"use server";

import { getTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { getReporteFinanciero } from "@/lib/queries/negocio.queries";

/** Genera el CSV del reporte financiero del período (owner). */
export async function getReporteCsvAction(
  desde: string,
  hasta: string
): Promise<{ ok: boolean; error?: string; csv?: string }> {
  const tenant = await getTenant();
  if (!hasPermission(tenant.role, "ver_dashboard_ingresos")) {
    return { ok: false, error: "No tienes permiso." };
  }

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
