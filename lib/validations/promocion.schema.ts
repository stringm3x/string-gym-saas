import { z } from "zod";

export const tipoPromocionEnum = z.enum(["membresia", "producto"]);

export const promocionSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(80, "El nombre es demasiado largo"),
    tipo: tipoPromocionEnum,
    precio: z
      .number({ invalid_type_error: "Precio inválido" })
      .nonnegative("El precio no puede ser negativo")
      .max(1_000_000, "Precio demasiado alto"),
    dias_duracion: z.number().int().positive().max(3650).optional().nullable(),
    vigencia_desde: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
      .optional()
      .or(z.literal("")),
    vigencia_hasta: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => {
      // Membresía requiere duración.
      if (data.tipo === "membresia") {
        return data.dias_duracion && data.dias_duracion > 0;
      }
      return true;
    },
    {
      message: "Define la duración en días",
      path: ["dias_duracion"],
    }
  )
  .refine(
    (data) => {
      // Si hay ambas fechas, desde <= hasta.
      if (data.vigencia_desde && data.vigencia_hasta) {
        return data.vigencia_desde <= data.vigencia_hasta;
      }
      return true;
    },
    {
      message: "La fecha de inicio debe ser anterior a la de fin",
      path: ["vigencia_hasta"],
    }
  );

export type PromocionInput = z.infer<typeof promocionSchema>;
