import { z } from "zod";

export const productoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(80, "El nombre es demasiado largo"),
  categoria: z.string().trim().max(40).optional().or(z.literal("")),
  precio: z
    .number({ invalid_type_error: "Precio inválido" })
    .nonnegative("El precio no puede ser negativo")
    .max(1_000_000, "Precio demasiado alto"),
  costo: z.number().nonnegative().max(1_000_000).optional().nullable(),
  stock_inicial: z.number().int().nonnegative().optional().nullable(),
  stock_minimo: z.number().int().nonnegative().optional().nullable(),
});

export type ProductoInput = z.infer<typeof productoSchema>;

export const movimientoSchema = z.object({
  producto_id: z.string().uuid("Producto inválido"),
  tipo: z.enum(["entrada", "salida", "ajuste"]),
  cantidad: z
    .number({ invalid_type_error: "Cantidad inválida" })
    .int("Debe ser un número entero")
    .refine((v) => v !== 0, "La cantidad no puede ser 0"),
  motivo: z.string().trim().max(200).optional().or(z.literal("")),
});

export type MovimientoInput = z.infer<typeof movimientoSchema>;
