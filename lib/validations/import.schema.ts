import { z } from "zod";

const fechaIso = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Fecha inválida (usa YYYY-MM-DD)" })
  .optional()
  .or(z.literal(""));

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
