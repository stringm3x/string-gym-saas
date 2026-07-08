export const runtime = "nodejs";

// Plantilla CSV para importar miembros (Fase P.1). Contenido genérico (filas
// de ejemplo), no depende del tenant; el slug solo estructura la URL.
const CSV = [
  "# Llena una fila por miembro. Columnas: nombre (requerido) | telefono (10 dígitos) | plan (nombre EXACTO de tu plan) | fecha_vencimiento (AAAA-MM-DD). Borra estas 3 filas de ejemplo antes de importar.",
  "nombre,telefono,plan,fecha_vencimiento",
  "Juan Pérez,5512345678,Mensual,2026-08-01",
  "María López,5598765432,Trimestral,2026-09-15",
  "Carlos García,5567891234,Mensual,2026-07-20",
].join("\r\n");

export async function GET() {
  return new Response("﻿" + CSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plantilla-miembros.csv"',
      "Cache-Control": "no-store",
    },
  });
}
