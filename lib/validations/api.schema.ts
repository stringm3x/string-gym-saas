import { z } from "zod";

export const apiReservaSchema = z.object({
  sesion_id: z.string().min(1, { error: "sesion_id es requerido." }),
  nombre: z.string().trim().min(1, { error: "nombre es requerido." }).max(120),
  telefono: z
    .string()
    .trim()
    .min(1, { error: "telefono es requerido." })
    .max(30),
  email: z.string().trim().email({ error: "email inválido." }).optional().or(z.literal("")),
  miembro_id: z.string().optional(),
});

export const apiProspectoSchema = z.object({
  nombre: z.string().trim().min(1, { error: "nombre es requerido." }).max(120),
  telefono: z
    .string()
    .trim()
    .min(1, { error: "telefono es requerido." })
    .max(30),
  email: z.string().trim().email({ error: "email inválido." }).optional().or(z.literal("")),
  mensaje: z.string().trim().max(1000).optional(),
  origen_detalle: z.string().trim().max(120).optional(),
});

/** Primer mensaje de error de un ZodError, para respuestas de la API. */
export function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos.";
}
