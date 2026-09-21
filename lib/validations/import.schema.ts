import { z } from "zod";

/**
 * Acepta AAAA-MM-DD (ya lo aceptaba) o DD/MM/AAAA (bloque 09: Excel en
 * español exporta así, y antes la fila entera se rechazaba). Normaliza
 * siempre a AAAA-MM-DD — el resto del código (bulkCreateMiembros,
 * comparaciones de fecha) asume ese formato.
 */
function normalizarFecha(val: string, ctx: z.RefinementCtx): string {
  const v = val.trim();
  if (v === "") return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${yyyy}-${mm}-${dd}`;
  }
  ctx.addIssue({
    code: "custom",
    message: "Fecha inválida (usa AAAA-MM-DD o DD/MM/AAAA)",
  });
  return z.NEVER;
}

const fechaIso = z.string().transform(normalizarFecha).optional();

export const csvRowSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1, { error: "Nombre requerido" })
      .max(200, { error: "Nombre demasiado largo" }),
    telefono: z
      .string()
      .trim()
      .max(20, { error: "Teléfono demasiado largo" })
      .optional()
      .or(z.literal("")),
    email: z
      .string()
      .trim()
      .email({ error: "Correo inválido" })
      .optional()
      .or(z.literal("")),
    fecha_inscripcion: fechaIso,
    fecha_vencimiento: fechaIso,
    plan: z.string().trim().max(120).optional().or(z.literal("")),
    notas: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .refine((d) => Boolean(d.telefono) || Boolean(d.email), {
    error: "Debe tener al menos teléfono o email",
    path: ["telefono"],
  });

export type CSVRowInput = z.infer<typeof csvRowSchema>;

/** Columnas esperadas en el CSV (en orden, para la plantilla). */
export const CSV_COLUMNS = [
  "nombre",
  "telefono",
  "email",
  "fecha_inscripcion",
  "fecha_vencimiento",
  "plan",
  "notas",
] as const;
