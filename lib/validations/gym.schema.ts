import { z } from "zod/v4";

export const gymConfigSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, { error: "Nombre demasiado corto" })
    .max(80, { error: "Nombre demasiado largo" }),
  telefono: z.string().trim().max(20, { error: "Teléfono demasiado largo" }).optional(),
  direccion: z.string().trim().max(200, { error: "Dirección demasiado larga" }).optional(),
  rfc: z.string().trim().max(13, { error: "RFC inválido" }).optional(),
  checkin_bloquea_vencidos: z.boolean(),
  congelacion_auto_aprobar: z.boolean(),
});

export type GymConfigInput = z.infer<typeof gymConfigSchema>;
