import { z } from "zod";

export const PLANTILLA_CATEGORIAS = [
  "miembro_activo",
  "miembro_por_vencer",
  "miembro_vencido",
  "prospecto",
  "general",
] as const;

export type PlantillaCategoria = (typeof PLANTILLA_CATEGORIAS)[number];

export const plantillaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(80, "El nombre es demasiado largo"),
  categoria: z.enum(PLANTILLA_CATEGORIAS, {
    error: "Categoría inválida",
  }),
  contenido: z
    .string()
    .trim()
    .min(5, "El contenido debe tener al menos 5 caracteres")
    .max(1000, "El contenido es demasiado largo"),
  activo: z.boolean().default(true),
});

export type PlantillaInput = z.infer<typeof plantillaSchema>;
