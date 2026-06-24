import { z } from "zod";

/** Paleta fija de colores para clases (sin picker libre). */
export const COLORES_CLASE = [
  "#10b981", // verde
  "#3b82f6", // azul
  "#ef4444", // rojo
  "#8b5cf6", // morado
  "#f97316", // naranja
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;
const HHMM = /^\d{2}:\d{2}$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export const claseInputSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1, { error: "El nombre es requerido." })
      .max(100, { error: "Máximo 100 caracteres." }),
    tipo: z.enum(["regular", "gratis", "taller", "privada"]),
    instructor: z
      .string()
      .trim()
      .max(100, { error: "Máximo 100 caracteres." })
      .optional()
      .or(z.literal("")),
    color: z
      .string()
      .regex(HEX, { error: "Color inválido." })
      .default("#10b981"),
    duracion_minutos: z.coerce
      .number()
      .int()
      .min(15, { error: "Mínimo 15 minutos." })
      .max(240, { error: "Máximo 240 minutos." }),
    cupo_maximo: z.coerce
      .number()
      .int()
      .min(1, { error: "Mínimo 1 lugar." })
      .max(200, { error: "Máximo 200 lugares." }),
    es_recurrente: z.boolean(),
    dias_semana: z.array(z.number().int().min(0).max(6)).default([]),
    hora_inicio: z.string().regex(HHMM, { error: "Hora inválida (HH:MM)." }),
    fecha_inicio: z.string().regex(YMD, { error: "Fecha inválida." }),
    fecha_fin: z
      .string()
      .regex(YMD, { error: "Fecha inválida." })
      .optional()
      .or(z.literal("")),
  })
  .refine((d) => !d.es_recurrente || d.dias_semana.length >= 1, {
    error: "Selecciona al menos un día.",
    path: ["dias_semana"],
  })
  .refine((d) => !d.fecha_fin || d.fecha_fin > d.fecha_inicio, {
    error: "La fecha de fin debe ser posterior al inicio.",
    path: ["fecha_fin"],
  });

export type ClaseFormValues = z.infer<typeof claseInputSchema>;
