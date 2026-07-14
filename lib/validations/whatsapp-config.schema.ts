import { z } from "zod/v4";

export const whatsappConfigSchema = z.object({
  activo: z.boolean(),
  numero: z
    .string()
    .trim()
    .max(20, { error: "Número demasiado largo" })
    .optional()
    .or(z.literal("")),
  // Blanco = conservar la API key existente (no se re-expone en el form).
  api_key: z
    .string()
    .trim()
    .max(300, { error: "API key demasiado larga" })
    .optional()
    .or(z.literal("")),
  // Umbral de alerta de visitas bajas (D8). 0 = desactivado.
  alerta_visitas_umbral: z
    .number()
    .int()
    .min(0)
    .max(1000)
    .optional(),
});

export type WhatsappConfigInput = z.infer<typeof whatsappConfigSchema>;
