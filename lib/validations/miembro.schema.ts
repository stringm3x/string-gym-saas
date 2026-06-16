import { z } from "zod";

/**
 * Schema base de un miembro — usado para creación y edición.
 * Telefono y email son opcionales pero al menos uno debe existir
 * (para poder contactarlo). Esa regla se valida con .refine.
 */
export const miembroSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(120, "El nombre es demasiado largo"),
    telefono: z
      .string()
      .trim()
      .max(20, "Teléfono inválido")
      .optional()
      .or(z.literal("")),
    email: z
      .string()
      .trim()
      .email("Correo inválido")
      .optional()
      .or(z.literal("")),
    fecha_inscripcion: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    fecha_vencimiento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => Boolean(data.telefono) || Boolean(data.email), {
    message: "Debes capturar al menos teléfono o correo",
    path: ["telefono"],
  });

export type MiembroInput = z.infer<typeof miembroSchema>;
