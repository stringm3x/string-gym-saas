/**
 * Exportación de miembros a CSV (feature `exportacion_datos`, todos los
 * planes). Se usa desde el botón "Exportar CSV" de la lista y desde las
 * acciones masivas (Pro) con la selección.
 */

export interface MiembroCsvRow {
  nombre: string;
  telefono: string | null;
  email: string | null;
  fecha_inscripcion: string;
  fecha_vencimiento: string | null;
  estado: string;
}

export function miembrosToCsv(miembros: MiembroCsvRow[]): string {
  const headers = [
    "Nombre",
    "Teléfono",
    "Email",
    "Inscripción",
    "Vencimiento",
    "Estado",
  ];
  const rows = miembros.map((m) => [
    m.nombre,
    m.telefono ?? "",
    m.email ?? "",
    m.fecha_inscripcion,
    m.fecha_vencimiento ?? "",
    m.estado,
  ]);
  return [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

/** Dispara la descarga en el navegador (BOM para que Excel lea acentos). */
export function descargarMiembrosCsv(miembros: MiembroCsvRow[]): void {
  const blob = new Blob(["﻿" + miembrosToCsv(miembros)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `miembros-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
