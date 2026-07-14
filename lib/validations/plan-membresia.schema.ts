import { z } from "zod";

export const planMembresiaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(80, "El nombre es demasiado largo"),
  precio: z
    .number({ error: "Precio inválido" })
    .nonnegative("El precio no puede ser negativo")
    .max(1_000_000, "Precio demasiado alto"),
  dias_duracion: z
    .number({ error: "Duración inválida" })
    .int("Debe ser un número entero")
    .positive("La duración debe ser mayor a 0")
    .max(3650, "Máximo 10 años"),
  tipo: z.enum(["tiempo", "visitas", "paquete"]).default("tiempo"),
  visitas: z
    .number()
    .int("Debe ser un número entero")
    .positive("Debe ser mayor a 0")
    .max(1000, "Demasiadas visitas")
    .nullable()
    .optional(),
})
  .refine(
    (d) => d.tipo === "tiempo" || (d.visitas != null && d.visitas > 0),
    { error: "Indica el número de visitas", path: ["visitas"] }
  )
  // Los planes por tiempo no llevan visitas.
  .transform((d) => ({
    ...d,
    visitas: d.tipo === "tiempo" ? null : (d.visitas ?? null),
  }));

export type PlanMembresiaInput = z.infer<typeof planMembresiaSchema>;
