import { z } from "zod";

export const conceptoPagoEnum = z.enum([
  "membresia",
  "visita",
  "producto",
  "otro",
]);
export const metodoPagoEnum = z.enum(["efectivo", "tarjeta", "transferencia"]);

export const pagoSchema = z
  .object({
    miembro_id: z
      .string()
      .uuid("Selecciona un miembro")
      .optional()
      .or(z.literal("")),
    concepto: conceptoPagoEnum,
    monto: z
      .number({ error: "Monto inválido" })
      .positive("El monto debe ser mayor a 0")
      .max(1_000_000, "Monto demasiado alto"),
    metodo_pago: metodoPagoEnum,
    periodo_inicio: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
      .optional()
      .or(z.literal("")),
    periodo_fin: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
      .optional()
      .or(z.literal("")),
    plan_id: z.string().uuid().optional().or(z.literal("")),
    promocion_id: z.string().uuid().optional().or(z.literal("")),
    producto_id: z.string().uuid().optional().or(z.literal("")),
    /** Cantidad vendida del producto (descuenta del stock). Default 1. */
    cantidad_producto: z.number().int().positive().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.concepto === "membresia" || data.concepto === "visita") {
        return Boolean(data.miembro_id);
      }
      return true;
    },
    {
      message: "Selecciona un miembro para este tipo de pago",
      path: ["miembro_id"],
    }
  )
  .refine(
    (data) => {
      if (data.concepto === "membresia") {
        return Boolean(data.periodo_inicio) && Boolean(data.periodo_fin);
      }
      return true;
    },
    {
      message: "Define el periodo de la membresía",
      path: ["periodo_fin"],
    }
  );

export type PagoInput = z.infer<typeof pagoSchema>;
