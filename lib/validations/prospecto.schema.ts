import { z } from "zod";

export const ORIGENES = ["landing", "whatsapp", "referido", "manual"] as const;
export const ESTADOS = [
  "nuevo",
  "contactado",
  "agendado",
  "convertido",
  "descartado",
] as const;

export type ProspectoOrigen = (typeof ORIGENES)[number];
export type ProspectoEstado = (typeof ESTADOS)[number];

export const prospectoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(120, "El nombre es demasiado largo"),
  telefono: z
    .string()
    .trim()
    .min(1, "El teléfono es requerido")
    .max(20, "Teléfono inválido"),
  email: z
    .string()
    .trim()
    .email("Correo inválido")
    .optional()
    .or(z.literal("")),
  origen: z.enum(ORIGENES).default("manual"),
  estado: z.enum(ESTADOS),
  fecha_prueba_agendada: z.string().optional().or(z.literal("")),
  notas: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type ProspectoInput = z.infer<typeof prospectoSchema>;
