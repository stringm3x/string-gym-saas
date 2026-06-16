import { z } from "zod";

export const TAG_COLORS = [
  "success",
  "warning",
  "danger",
  "info",
  "neutral",
  "gold",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export const tagSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(30, "El nombre es demasiado largo"),
  color: z.enum(TAG_COLORS),
});

export type TagInput = z.infer<typeof tagSchema>;
