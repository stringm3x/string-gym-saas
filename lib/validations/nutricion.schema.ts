import { z } from "zod";

/** Un tiempo de comida del plan. */
export const comidaNutricionSchema = z.object({
  tiempo: z.string().trim().max(60, "Nombre del tiempo muy largo"),
  alimentos: z.string().trim().max(2000, "Descripción muy larga"),
});

export const planNutricionInputSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(1, "Ponle un título al plan")
    .max(120, "Título muy largo"),
  objetivo: z.string().trim().max(200, "Objetivo muy largo").nullish(),
  calorias_objetivo: z
    .number({ error: "Calorías inválidas" })
    .int("Calorías inválidas")
    .min(0, "Calorías inválidas")
    .max(20000, "Calorías fuera de rango")
    .nullish(),
  comidas: z.array(comidaNutricionSchema).max(20, "Máximo 20 tiempos de comida"),
  notas: z.string().trim().max(2000, "Notas muy largas").nullish(),
});

export type PlanNutricionInput = z.infer<typeof planNutricionInputSchema>;
