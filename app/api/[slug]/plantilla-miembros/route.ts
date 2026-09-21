import { CSV_COLUMNS } from "@/lib/validations/import.schema";

export const runtime = "nodejs";

// Plantilla CSV para importar miembros (Fase P.1). Contenido genérico (filas
// de ejemplo), no depende del tenant; el slug solo estructura la URL.
//
// Bloque 09: antes esta plantilla solo traía nombre/telefono/plan/
// fecha_vencimiento — email, fecha_inscripcion y notas ya los acepta
// csvRowSchema (CSV_COLUMNS), pero nadie sabía que existían porque la
// plantilla nunca los mencionó. Sin correo, el socio importado no puede
// usar el portal.
const CSV = [
  "# Llena una fila por miembro. Columnas: nombre (requerido) | telefono (10 dígitos, requerido si no hay email) | email (requerido si no hay teléfono — sin correo no hay portal) | fecha_inscripcion (AAAA-MM-DD o DD/MM/AAAA, opcional) | fecha_vencimiento (AAAA-MM-DD o DD/MM/AAAA) | plan (nombre EXACTO de tu plan) | notas (opcional). Borra estas 3 filas de ejemplo antes de importar.",
  CSV_COLUMNS.join(","),
  "Juan Pérez,5512345678,juan@correo.com,2026-01-05,2026-08-01,Mensual,",
  "María López,5598765432,,15/01/2026,15/09/2026,Trimestral,Alérgica al polvo",
  "Carlos García,5567891234,carlos@correo.com,,2026-07-20,Mensual,",
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
